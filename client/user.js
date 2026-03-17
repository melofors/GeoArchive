import { API_BASE_URL } from './config.js';
import { auth, onAuthStateChanged } from './auth.js';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getViewingUsername() {
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  if (pathParts[0] === 'user' && pathParts[1]) return pathParts[1];
  const params = new URLSearchParams(window.location.search);
  return params.get('username');
}

async function loadUserProfile() {
  const username = getViewingUsername();

  if (!username) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').style.display = 'block';
    document.getElementById('error').textContent = 'No username provided';
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/user/${encodeURIComponent(username)}`);

    if (!response.ok) {
      throw new Error(response.status === 404 ? 'User not found' : 'Failed to load profile');
    }

    const userData = await response.json();

    document.title = `@${userData.username}'s Profile`;
    document.getElementById('avatar-letter').textContent = userData.username.charAt(0).toUpperCase();
    document.getElementById('username').textContent = `@${escapeHtml(userData.username)}`;
    document.getElementById('joined-date').textContent = userData.created_at
      ? new Date(userData.created_at).toDateString()
      : 'Unknown';
    document.getElementById('bio-text').textContent = userData.bio || 'No bio yet.';
    document.getElementById('submission-count').textContent = userData.submissionCount;
    document.getElementById('view-submissions').href = `/database.html?uploader=${encodeURIComponent(userData.username)}`;

    document.getElementById('loading').style.display = 'none';
    document.getElementById('profile-content').style.display = 'block';

    setupBioEditor(userData.username, userData.bio || '');

  } catch (err) {
    console.error('Error loading profile:', err);
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').style.display = 'block';
    document.getElementById('error').textContent = err.message;
  }
}

function setupBioEditor(viewingUsername, currentBio) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const meRes = await fetch(`${API_BASE_URL}/api/user/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!meRes.ok) return;
      const meData = await meRes.json();
      if (meData.username !== viewingUsername) return;
    } catch {
      return;
    }

    // Add edit link to bio header
    const bioHeader = document.getElementById('bio-header');
    bioHeader.innerHTML = `Bio <a href="#" id="edit-bio-link" style="font-size:0.85rem; font-weight:normal; margin-left:0.5rem;">(edit bio)</a>`;

    // Add modal to DOM
    document.body.insertAdjacentHTML('beforeend', `
      <div id="bio-overlay" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.4); z-index:999;"></div>
      <div id="bio-modal" style="display:none; position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:#fff; padding:2rem; border-radius:8px; z-index:1000; min-width:320px; box-shadow:0 4px 24px rgba(0,0,0,0.15);">
        <h3 style="margin:0 0 1rem;">Edit Bio</h3>
        <textarea id="bio-input" rows="4" maxlength="300" style="width:100%; box-sizing:border-box; margin-bottom:0.5rem; padding:0.5rem;"></textarea>
        <p style="font-size:0.8rem; color:#888; margin:0 0 1rem;">Max 300 characters</p>
        <div style="display:flex; gap:0.5rem; justify-content:flex-end;">
          <button id="close-bio-btn" style="padding:0.4rem 1rem;">Cancel</button>
          <button id="save-bio-btn" style="padding:0.4rem 1rem;">Save</button>
        </div>
      </div>
    `);

    const overlay = document.getElementById('bio-overlay');
    const modal = document.getElementById('bio-modal');
    const input = document.getElementById('bio-input');

    document.getElementById('edit-bio-link').addEventListener('click', (e) => {
      e.preventDefault();
      input.value = document.getElementById('bio-text').textContent === 'No bio yet.'
        ? ''
        : document.getElementById('bio-text').textContent;
      modal.style.display = 'block';
      overlay.style.display = 'block';
      input.focus();
    });

    const closeModal = () => {
      modal.style.display = 'none';
      overlay.style.display = 'none';
    };

    document.getElementById('close-bio-btn').addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);

    document.getElementById('save-bio-btn').addEventListener('click', async () => {
      const newBio = input.value.trim();
      const saveBtn = document.getElementById('save-bio-btn');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      try {
        const token = await user.getIdToken();
        const res = await fetch(`${API_BASE_URL}/api/user/bio`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ bio: newBio })
        });

        if (res.ok) {
          document.getElementById('bio-text').textContent = newBio || 'No bio yet.';
          closeModal();
        } else {
          alert('Failed to save bio. Please try again.');
        }
      } catch (err) {
        console.error('Bio save error:', err);
        alert('Network error. Please try again.');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', loadUserProfile);