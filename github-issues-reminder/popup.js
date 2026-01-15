document.addEventListener('DOMContentLoaded', () => {
  const repoInput = document.getElementById('repoInput');
  const addBtn = document.getElementById('addBtn');
  const checkNowBtn = document.getElementById('checkNowBtn');
  const repoList = document.getElementById('repoList');
  const messageDiv = document.getElementById('message');
  const tokenInput = document.getElementById('tokenInput');
  const saveTokenBtn = document.getElementById('saveTokenBtn');
  const removeTokenBtn = document.getElementById('removeTokenBtn');

  // Load repos
  chrome.storage.sync.get(['repos'], (result) => {
    const repos = result.repos || [];
    renderRepos(repos);
  });

  // Load token (show masked version)
  let tokenSaved = false;
  chrome.storage.sync.get(['githubToken'], (result) => {
    if (result.githubToken) {
      tokenInput.value = '••••••••••••••••';
      tokenInput.placeholder = 'Token saved';
      tokenSaved = true;
    }
  });

  // Clear masked token on focus
  tokenInput.addEventListener('focus', () => {
    if (tokenInput.value === '••••••••••••••••') {
      tokenInput.value = '';
      tokenSaved = false;
    }
  });

  // Save token
  saveTokenBtn.addEventListener('click', () => {
    const token = tokenInput.value.trim();
    if (token && token !== '••••••••••••••••') {
      chrome.storage.sync.set({ githubToken: token }, () => {
        tokenInput.value = '••••••••••••••••';
        tokenInput.placeholder = 'Token saved';
        tokenSaved = true;
        showMessage('Token saved!', 'green');
      });
    } else if (tokenSaved || token === '••••••••••••••••') {
      showMessage('Token already saved', 'orange');
    } else {
      showMessage('Please enter a valid token', 'red');
    }
  });

  // Remove token
  removeTokenBtn.addEventListener('click', () => {
    chrome.storage.sync.remove(['githubToken'], () => {
      tokenInput.value = '';
      tokenInput.placeholder = 'ghp_xxxxxxxxxxxx';
      tokenSaved = false;
      showMessage('Token removed', 'green');
    });
  });

  checkNowBtn.addEventListener('click', () => {
    checkNowBtn.disabled = true;
    checkNowBtn.textContent = 'Checking...';
    chrome.runtime.sendMessage({ action: 'check-now' }, (response) => {
      checkNowBtn.disabled = false;
      checkNowBtn.textContent = 'Check Now';
      if (chrome.runtime.lastError) {
        showMessage('Error: ' + chrome.runtime.lastError.message, 'red');
      } else {
        showMessage('Check completed!', 'green');
      }
    });
  });

  addBtn.addEventListener('click', () => {
    const repo = repoInput.value.trim();
    if (validateRepo(repo)) {
      addRepo(repo);
    } else {
      showMessage('Invalid format. Use owner/repo', 'red');
    }
  });

  function validateRepo(repo) {
    const parts = repo.split('/');
    return parts.length === 2 && parts[0].length > 0 && parts[1].length > 0;
  }

  function addRepo(repo) {
    chrome.storage.sync.get(['repos'], (result) => {
      const repos = result.repos || [];
      if (!repos.includes(repo)) {
        repos.push(repo);
        chrome.storage.sync.set({ repos: repos }, () => {
          // Initialize lastCheck for this repo to now, so we don't fetch old issues
          // But we want to ensure the background script picks it up correctly.
          chrome.storage.local.get(['lastChecks'], (result) => {
            const lastChecks = result.lastChecks || {};
            // Set it to 1 minute ago to be safe
            const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
            lastChecks[repo] = oneMinuteAgo;
            chrome.storage.local.set({ lastChecks: lastChecks });
          });

          renderRepos(repos);
          repoInput.value = '';
          showMessage('Repository added!', 'green');
        });
      } else {
        showMessage('Repository already tracked', 'orange');
      }
    });
  }

  function removeRepo(repo) {
    chrome.storage.sync.get(['repos'], (result) => {
      const repos = result.repos || [];
      const newRepos = repos.filter(r => r !== repo);
      chrome.storage.sync.set({ repos: newRepos }, () => {
        renderRepos(newRepos);
      });
    });
  }

  function renderRepos(repos) {
    repoList.innerHTML = '';
    if (repos.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.innerHTML = '<div class="empty-state-icon">📦</div><div>No repos tracked</div>';
      repoList.appendChild(emptyState);
      return;
    }
    repos.forEach(repo => {
      const li = document.createElement('li');
      const repoText = document.createElement('span');
      repoText.textContent = repo;
      repoText.className = 'repo-name';
      repoText.title = repo; // Tooltip for full name
      
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = '×';
      deleteBtn.className = 'delete-btn';
      deleteBtn.title = 'Remove repository';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeRepo(repo);
      });
      
      li.appendChild(repoText);
      li.appendChild(deleteBtn);
      repoList.appendChild(li);
    });
  }

  function showMessage(msg, color) {
    messageDiv.textContent = msg;
    messageDiv.style.color = color;
    messageDiv.style.display = 'block';
    setTimeout(() => {
      messageDiv.textContent = '';
      messageDiv.style.display = 'none';
    }, 3000);
  }
});
