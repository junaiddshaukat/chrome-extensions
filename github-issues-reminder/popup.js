document.addEventListener('DOMContentLoaded', () => {
  const repoInput = document.getElementById('repoInput');
  const addBtn = document.getElementById('addBtn');
  const checkNowBtn = document.getElementById('checkNowBtn');
  const repoList = document.getElementById('repoList');
  const messageDiv = document.getElementById('message');

  // Load repos
  chrome.storage.sync.get(['repos'], (result) => {
    const repos = result.repos || [];
    renderRepos(repos);
  });

  checkNowBtn.addEventListener('click', () => {
    checkNowBtn.disabled = true;
    checkNowBtn.textContent = 'Checking...';
    chrome.runtime.sendMessage({ action: 'check-now' }, (response) => {
      checkNowBtn.disabled = false;
      checkNowBtn.textContent = 'Check for Issues Now';
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
    repos.forEach(repo => {
      const li = document.createElement('li');
      li.textContent = repo;
      
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'X';
      deleteBtn.className = 'delete-btn';
      deleteBtn.addEventListener('click', () => removeRepo(repo));
      
      li.appendChild(deleteBtn);
      repoList.appendChild(li);
    });
  }

  function showMessage(msg, color) {
    messageDiv.textContent = msg;
    messageDiv.style.color = color;
    setTimeout(() => {
      messageDiv.textContent = '';
    }, 3000);
  }
});
