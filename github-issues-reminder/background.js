const ALARM_NAME = 'github-issue-poller';
const POLLING_INTERVAL_MINUTES = 1;

chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed/updated');
  // Create or replace the alarm
  chrome.alarms.create(ALARM_NAME, {
    periodInMinutes: POLLING_INTERVAL_MINUTES
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    checkIssues();
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'check-now') {
    checkIssues().then(() => {
      sendResponse({ status: 'done' });
    });
    return true; // Required for async sendResponse
  }
});

// Retry logic with exponential backoff
async function fetchWithRetry(url, headers, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, { headers });
      
      // Check rate limit headers
      const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
      const rateLimitReset = response.headers.get('X-RateLimit-Reset');
      
      // Handle rate limiting (429 or 403 with rate limit = 0)
      if (response.status === 429 || (response.status === 403 && rateLimitRemaining === '0')) {
        const resetTime = rateLimitReset ? parseInt(rateLimitReset) * 1000 : Date.now() + 60000;
        const waitTime = Math.min(resetTime - Date.now(), 60000); // Max 60 seconds wait
        
        if (attempt < maxRetries - 1 && waitTime > 0) {
          console.log(`Rate limit hit. Waiting ${Math.round(waitTime / 1000)}s before retry ${attempt + 2}/${maxRetries}...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        } else {
          throw new Error(`Rate limit exceeded. Reset at ${new Date(resetTime).toLocaleTimeString()}`);
        }
      }
      
      // Handle other errors
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error(`Access forbidden. Repository may be private or token invalid.`);
        } else if (response.status === 404) {
          throw new Error(`Repository not found.`);
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      }
      
      return response;
    } catch (error) {
      // If it's the last attempt or not a rate limit error, throw
      if (attempt === maxRetries - 1 || !error.message.includes('Rate limit')) {
        throw error;
      }
      
      // Exponential backoff for other errors
      const backoffTime = Math.min(1000 * Math.pow(2, attempt), 10000);
      console.log(`Request failed. Retrying in ${backoffTime}ms... (${attempt + 2}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, backoffTime));
    }
  }
}

async function checkIssues() {
  try {
    const { repos } = await chrome.storage.sync.get(['repos']);
    if (!repos || repos.length === 0) return;

    const { lastChecks } = await chrome.storage.local.get(['lastChecks']);
    const newLastChecks = { ...lastChecks };
    const now = new Date().toISOString();

    for (const repo of repos) {
      const lastCheck = newLastChecks[repo];

      if (!lastCheck) {
        // First time checking this repo, just set the timestamp
        newLastChecks[repo] = now;
        continue;
      }

      try {
        const url = `https://api.github.com/repos/${repo}/issues?since=${lastCheck}&state=all`;
        
        // Get GitHub token if available
        const { githubToken } = await chrome.storage.sync.get(['githubToken']);
        
        // Build headers - User-Agent is required by GitHub API
        const headers = {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'GitHub-Issue-Reminder-Extension'
        };
        
        // Add authentication if token is available
        if (githubToken) {
          headers['Authorization'] = `token ${githubToken}`;
        }
        
        const response = await fetchWithRetry(url, headers);
        const issues = await response.json();

        // Filter for issues created after the last check
        // And ensure it is an issue, not a PR (GitHub API returns PRs as issues sometimes, but they have pull_request key)
        const newIssues = issues.filter(issue => {
          return issue.created_at > lastCheck && !issue.pull_request;
        });

        if (newIssues.length > 0) {
          newIssues.forEach(issue => {
            createNotification(repo, issue);
          });
          
          // Update timestamp to the most recent created_at to avoid duplicates
          // Sort to find the latest
          newIssues.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          newLastChecks[repo] = newIssues[0].created_at;
        } else {
            // If no new issues, but we checked successfully, we can update the timestamp 
            // to avoid checking old data again, but 'since' works on updated_at.
            // If we update lastCheck to 'now', we might miss issues created between request start and 'now'.
            // Safer to keep it as is, or update to the latest updated_at seen.
            // For simplicity, let's just update it if we found nothing to 'now' is risky.
            // Let's leave it, or update to the latest updated_at from the response if available.
            // Actually, if we don't update, we keep fetching the same updated issues (comments etc).
            // So we SHOULD update the lastCheck to avoid processing same updates.
            // But we only care about CREATION.
            // If we only care about creation, we can keep lastCheck as the last time we successfully checked?
            // No, 'since' filters by updated_at.
            // If an old issue is updated, it returns. We filter it out because created_at < lastCheck.
            // So we are fine. We don't strictly need to update lastCheck if no NEW issue is found, 
            // but it saves bandwidth to update it to the latest updated_at seen.
            // Let's just update it to 'now' to move the window forward, assuming we processed everything.
            newLastChecks[repo] = now;
        }

      } catch (error) {
        console.error(`Failed to check ${repo}:`, error.message);
        // Don't update lastCheck on error, so we retry next time
      }
    }

    await chrome.storage.local.set({ lastChecks: newLastChecks });

  } catch (error) {
    console.error('Error in checkIssues:', error);
  }
}

function createNotification(repo, issue) {
  const notificationId = `issue-${issue.id}`;
  chrome.notifications.create(notificationId, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon48.png'),
    title: `New Issue in ${repo}`,
    message: issue.title,
    contextMessage: `By ${issue.user.login}`,
    buttons: [{ title: 'View Issue' }],
    requireInteraction: true
  });

  // Store the URL for the click handler
  chrome.storage.local.set({ [notificationId]: issue.html_url });
}

chrome.notifications.onClicked.addListener(async (notificationId) => {
  const data = await chrome.storage.local.get([notificationId]);
  const url = data[notificationId];
  if (url) {
    chrome.tabs.create({ url });
    chrome.storage.local.remove(notificationId);
  }
});

chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  if (buttonIndex === 0) {
    const data = await chrome.storage.local.get([notificationId]);
    const url = data[notificationId];
    if (url) {
      chrome.tabs.create({ url });
      chrome.storage.local.remove(notificationId);
    }
  }
});
