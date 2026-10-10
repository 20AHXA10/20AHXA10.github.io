const STORAGE_KEY = 'aguagua-admin-session-v2';
const DEFAULT_CONFIG = {
  owner: '20AHXA10',
  repo: '20AHXA10.github.io',
  branch: 'main',
  path: 'data/posts.json',
  token: ''
};

const DEFAULT_POSTS = [
  {
    id: 'post-1',
    title: '2024CSP游记',
    subtitle: 'emm...邮寄了',
    category: '游记',
    status: 'published',
    date: '2024-09-22',
    content: '## 2024CSP游记\n\nCSP 2024 的经历还记得很清晰，心情复杂而充满期待。\n\n- 报名阶段：认真准备，反复检查系统。\n- 考试当天：紧张但有条不紊。\n- 之后：结果不如预期，但也学到了很多。\n\n**感想**：只要认真参与，每一次经历都会变成宝贵的经验。'
  },
  {
    id: 'post-2',
    title: 'CsBlog',
    subtitle: '',
    category: '测试',
    status: 'draft',
    date: '2024-08-17',
    content: '## CsBlog\n\n这是一个用于测试博客后台的示例文章。\n\n- 可编辑标题\n- 可切换状态\n- 可预览内容\n\n> 后台现在可以同步到 GitHub 仓库。'
  }
];

const state = {
  posts: [],
  selectedId: null,
  config: readConfig(),
  authenticated: false,
  remoteSha: null
};

const loginView = document.getElementById('loginView');
const adminView = document.getElementById('adminView');
const loginForm = document.getElementById('loginForm');
const loginStatus = document.getElementById('loginStatus');
const tokenInput = document.getElementById('tokenInput');
const ownerInput = document.getElementById('ownerInput');
const repoInput = document.getElementById('repoInput');
const branchInput = document.getElementById('branchInput');
const pathInput = document.getElementById('pathInput');
const connectionStatus = document.getElementById('connectionStatus');
const repoSummary = document.getElementById('repoSummary');

const form = {
  title: document.getElementById('postTitle'),
  subtitle: document.getElementById('postSubtitle'),
  category: document.getElementById('postCategory'),
  status: document.getElementById('postStatus'),
  date: document.getElementById('postDate'),
  content: document.getElementById('postContent')
};

const preview = document.getElementById('previewContent');
const previewLabel = document.getElementById('previewLabel');
const postList = document.getElementById('postList');
const listSummary = document.getElementById('listSummary');

function readConfig() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : { ...DEFAULT_CONFIG };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.config));
}

function setLoginMessage(message, type = '') {
  loginStatus.textContent = message;
  loginStatus.className = 'status-text';
  if (type) {
    loginStatus.classList.add(type);
  }
}

function hydrateLoginForm() {
  tokenInput.value = state.config.token || '';
  ownerInput.value = state.config.owner || DEFAULT_CONFIG.owner;
  repoInput.value = state.config.repo || DEFAULT_CONFIG.repo;
  branchInput.value = state.config.branch || DEFAULT_CONFIG.branch;
  pathInput.value = state.config.path || DEFAULT_CONFIG.path;
}

function toggleViews() {
  loginView.classList.toggle('hidden', state.authenticated);
  adminView.classList.toggle('hidden', !state.authenticated);
}

function renderConnectionStatus() {
  const label = state.authenticated ? '已连接' : '未连接';
  connectionStatus.textContent = label;
  repoSummary.textContent = `${state.config.owner || 'owner'}/${state.config.repo || 'repo'}`;
}

function fetchGitHub(endpoint, options = {}) {
  const headers = {
    Accept: 'application/vnd.github+json',
    ...(options.headers || {})
  };

  if (state.config.token) {
    headers.Authorization = `token ${state.config.token}`;
  }

  return fetch(endpoint, {
    ...options,
    headers
  }).then(async (response) => {
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text;
    }

    if (!response.ok) {
      const detail = payload && payload.message ? payload.message : 'GitHub API 请求失败';
      throw new Error(detail);
    }

    return payload;
  });
}

function readFileAsText(fileContent) {
  const normalized = fileContent.replace(/\n/g, '');
  return decodeURIComponent(
    Array.from(atob(normalized), (char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`).join('')
  );
}

function encodeBase64(text) {
  return btoa(unescape(encodeURIComponent(text)));
}

async function connectToGitHub() {
  const config = {
    owner: ownerInput.value.trim(),
    repo: repoInput.value.trim(),
    branch: branchInput.value.trim() || 'main',
    path: pathInput.value.trim() || 'data/posts.json',
    token: tokenInput.value.trim()
  };

  if (!config.owner || !config.repo || !config.token) {
    setLoginMessage('请填写 GitHub Token、仓库所有者和仓库名称。', 'error');
    return;
  }

  state.config = config;
  saveConfig();
  renderConnectionStatus();

  try {
    const user = await fetchGitHub('https://api.github.com/user');
    if (!user || !user.login) {
      throw new Error('Token 无效，无法获取 GitHub 用户信息。');
    }
    state.authenticated = true;
    setLoginMessage(`已连接到 GitHub 用户：${user.login}。`, 'success');
    toggleViews();
    renderConnectionStatus();
    await loadPostsFromRemote();
  } catch (error) {
    state.authenticated = false;
    toggleViews();
    setLoginMessage(`连接失败：${error.message}`, 'error');
    renderConnectionStatus();
  }
}

async function ensureRemoteFile() {
  const filePath = state.config.path;
  const url = `https://api.github.com/repos/${state.config.owner}/${state.config.repo}/contents/${encodeURIComponent(filePath)}`;

  try {
    const remote = await fetchGitHub(`${url}?ref=${encodeURIComponent(state.config.branch)}`);
    state.remoteSha = remote.sha;
    return remote;
  } catch (error) {
    if (error.message.includes('Not Found')) {
      const payload = {
        message: 'Initialize blog posts data',
        content: encodeBase64(JSON.stringify(DEFAULT_POSTS, null, 2)),
        branch: state.config.branch
      };
      const created = await fetchGitHub(`https://api.github.com/repos/${state.config.owner}/${state.config.repo}/contents/${encodeURIComponent(filePath)}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      state.remoteSha = created.content && created.content.sha ? created.content.sha : null;
      return created;
    }
    throw error;
  }
}

async function loadPostsFromRemote() {
  try {
    const remote = await ensureRemoteFile();
    const remoteContent = remote.content && remote.content.content ? remote.content.content : remote.content;
    const text = remoteContent && remoteContent.content ? readFileAsText(remoteContent.content) : readFileAsText(remoteContent);
    const parsed = JSON.parse(text);
    state.posts = Array.isArray(parsed) ? parsed : DEFAULT_POSTS;
    state.remoteSha = remote.sha || state.remoteSha;
    if (!state.posts.length) {
      state.posts = DEFAULT_POSTS;
    }
    renderStats();
    renderPosts();
    if (!state.selectedId && state.posts.length) {
      state.selectedId = state.posts[0].id;
      populateForm(state.posts[0]);
    }
  } catch (error) {
    state.posts = DEFAULT_POSTS;
    renderStats();
    renderPosts();
    setLoginMessage(`读取远程文章失败：${error.message}`, 'error');
  }
}

async function syncPostsToRemote() {
  if (!state.authenticated) {
    setLoginMessage('请先连接 GitHub 仓库。', 'error');
    return;
  }

  const filePath = state.config.path;
  const url = `https://api.github.com/repos/${state.config.owner}/${state.config.repo}/contents/${encodeURIComponent(filePath)}`;
  const payload = {
    message: 'Update blog posts from admin dashboard',
    content: encodeBase64(JSON.stringify(state.posts, null, 2)),
    branch: state.config.branch
  };

  if (state.remoteSha) {
    payload.sha = state.remoteSha;
  }

  const result = await fetchGitHub(`${url}?ref=${encodeURIComponent(state.config.branch)}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });

  state.remoteSha = result.content && result.content.sha ? result.content.sha : state.remoteSha;
  setLoginMessage('文章已成功同步到 GitHub 仓库。', 'success');
}

function escapeHtml(value = '') {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderMarkdown(markdown = '') {
  const escaped = escapeHtml(markdown);
  const lines = escaped.split('\n');
  const html = [];
  let listBuffer = [];

  const flushParagraph = (paragraphLines) => {
    if (!paragraphLines.length) return;
    const text = paragraphLines.join('<br>');
    html.push(`<p>${text}</p>`);
  };

  const flushList = () => {
    if (listBuffer.length) {
      html.push(`<ul>${listBuffer.map((item) => `<li>${item}</li>`).join('')}</ul>`);
      listBuffer = [];
    }
  };

  let paragraph = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph(paragraph);
      paragraph = [];
      flushList();
      continue;
    }

    if (/^#+\s+/.test(line)) {
      flushParagraph(paragraph);
      paragraph = [];
      flushList();
      const headingLevel = line.match(/^#+/)[0].length;
      const headingText = line.replace(/^#+\s+/, '');
      html.push(`<h${headingLevel}>${headingText}</h${headingLevel}>`);
      continue;
    }

    if (/^-\s+/.test(line)) {
      flushParagraph(paragraph);
      paragraph = [];
      listBuffer.push(line.replace(/^-\s+/, ''));
      continue;
    }

    if (/^>\s+/.test(line)) {
      flushParagraph(paragraph);
      paragraph = [];
      flushList();
      html.push(`<blockquote>${line.replace(/^>\s+/, '')}</blockquote>`);
      continue;
    }

    paragraph.push(
      line
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    );
  }

  flushParagraph(paragraph);
  flushList();

  return html.join('');
}

function renderPreview() {
  const title = form.title.value.trim();
  const status = form.status.value;
  previewLabel.textContent = status === 'published' ? '已发布' : '草稿';

  if (!title && !form.content.value.trim()) {
    preview.innerHTML = '<p>写点内容后，这里会实时预览。</p>';
    return;
  }

  const titleHtml = title ? `<h2>${escapeHtml(title)}</h2>` : '';
  const subtitleHtml = form.subtitle.value.trim() ? `<p><strong>${escapeHtml(form.subtitle.value.trim())}</strong></p>` : '';
  const categoryHtml = form.category.value.trim() ? `<p><small>分类：${escapeHtml(form.category.value.trim())}</small></p>` : '';
  const dateHtml = form.date.value ? `<p><small>日期：${escapeHtml(form.date.value)}</small></p>` : '';
  preview.innerHTML = `${titleHtml}${subtitleHtml}${categoryHtml}${dateHtml}${renderMarkdown(form.content.value.trim())}`;
}

function renderStats() {
  const total = state.posts.length;
  const published = state.posts.filter((post) => post.status === 'published').length;
  const drafts = state.posts.filter((post) => post.status === 'draft').length;
  const categories = new Set(state.posts.map((post) => post.category.trim()).filter(Boolean)).size;

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statPublished').textContent = published;
  document.getElementById('statDrafts').textContent = drafts;
  document.getElementById('statCategories').textContent = categories;
}

function formatDate(dateString) {
  if (!dateString) return '未设置日期';
  const date = new Date(dateString + 'T00:00:00');
  if (Number.isNaN(date.getTime())) return '未设置日期';
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function renderPosts() {
  if (!state.posts.length) {
    postList.innerHTML = '<div class="empty-state">没有文章，点击“新建文章”开始写作。</div>';
    listSummary.textContent = '0 篇文章';
    return;
  }

  postList.innerHTML = state.posts
    .slice()
    .sort((a, b) => new Date(b.date || '1970-01-01') - new Date(a.date || '1970-01-01'))
    .map((post) => `
      <article class="post-item" data-id="${post.id}">
        <div>
          <h3>${escapeHtml(post.title || '未命名文章')}</h3>
          <div class="post-meta">
            <span>${escapeHtml(post.category || '未分类')}</span>
            <span>${formatDate(post.date)}</span>
            <span class="post-status ${post.status}">${post.status === 'published' ? '已发布' : '草稿'}</span>
          </div>
        </div>
        <div class="post-actions">
          <button type="button" class="icon-btn" data-action="edit" data-id="${post.id}">编辑</button>
          <button type="button" class="icon-btn" data-action="toggle" data-id="${post.id}">${post.status === 'published' ? '转草稿' : '发布'}</button>
          <button type="button" class="icon-btn danger" data-action="delete" data-id="${post.id}">删除</button>
        </div>
      </article>
    `)
    .join('');

  listSummary.textContent = `${state.posts.length} 篇文章`;
}

function populateForm(post) {
  form.title.value = post?.title || '';
  form.subtitle.value = post?.subtitle || '';
  form.category.value = post?.category || '';
  form.status.value = post?.status || 'published';
  form.date.value = post?.date || '';
  form.content.value = post?.content || '';
  renderPreview();
}

function resetForm() {
  state.selectedId = null;
  form.title.value = '';
  form.subtitle.value = '';
  form.category.value = '';
  form.status.value = 'published';
  form.date.value = new Date().toISOString().slice(0, 10);
  form.content.value = '';
  renderPreview();
}

async function saveCurrentPost() {
  const title = form.title.value.trim();
  const content = form.content.value.trim();

  if (!title || !content) {
    setLoginMessage('标题和正文不能为空。', 'error');
    return;
  }

  const payload = {
    id: state.selectedId || `post-${Date.now()}`,
    title,
    subtitle: form.subtitle.value.trim(),
    category: form.category.value.trim() || '未分类',
    status: form.status.value,
    date: form.date.value || new Date().toISOString().slice(0, 10),
    content
  };

  const hasExisting = state.posts.some((post) => post.id === payload.id);
  if (hasExisting) {
    state.posts = state.posts.map((post) => (post.id === payload.id ? payload : post));
  } else {
    state.posts.unshift(payload);
    state.selectedId = payload.id;
  }

  renderStats();
  renderPosts();
  populateForm(payload);

  try {
    await syncPostsToRemote();
  } catch (error) {
    setLoginMessage(`保存失败：${error.message}`, 'error');
  }
}

function togglePostStatus(id) {
  state.posts = state.posts.map((post) => {
    if (post.id !== id) return post;
    return { ...post, status: post.status === 'published' ? 'draft' : 'published' };
  });

  const selected = state.posts.find((post) => post.id === state.selectedId);
  if (selected) {
    populateForm(selected);
  }

  renderStats();
  renderPosts();
  syncPostsToRemote().catch((error) => setLoginMessage(`状态更新失败：${error.message}`, 'error'));
}

function deletePost(id) {
  const target = state.posts.find((post) => post.id === id);
  if (!target) return;

  const confirmed = window.confirm(`确认删除文章“${target.title}”？`);
  if (!confirmed) return;

  state.posts = state.posts.filter((post) => post.id !== id);
  renderStats();
  renderPosts();

  if (state.selectedId === id) {
    resetForm();
  }

  syncPostsToRemote().catch((error) => setLoginMessage(`删除失败：${error.message}`, 'error'));
}

function bindPostListEvents() {
  postList.addEventListener('click', (event) => {
    const trigger = event.target.closest('button');
    if (!trigger) return;

    const { action, id } = trigger.dataset;
    if (!action || !id) return;

    if (action === 'edit') {
      const post = state.posts.find((item) => item.id === id);
      if (!post) return;
      state.selectedId = id;
      populateForm(post);
      return;
    }

    if (action === 'toggle') {
      togglePostStatus(id);
      return;
    }

    if (action === 'delete') {
      deletePost(id);
    }
  });
}

function logout() {
  state.authenticated = false;
  state.remoteSha = null;
  state.posts = DEFAULT_POSTS;
  state.selectedId = null;
  tokenInput.value = '';
  state.config = { ...DEFAULT_CONFIG };
  saveConfig();
  toggleViews();
  renderConnectionStatus();
  populateForm(DEFAULT_POSTS[0]);
  renderStats();
  renderPosts();
  setLoginMessage('已退出登录。请重新输入 GitHub Token 继续。', 'success');
}

function initEvents() {
  loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    connectToGitHub();
  });

  Object.values(form).forEach((field) => {
    field.addEventListener('input', renderPreview);
    field.addEventListener('change', renderPreview);
  });

  document.getElementById('saveBtn').addEventListener('click', saveCurrentPost);
  document.getElementById('newPostBtn').addEventListener('click', resetForm);
  document.getElementById('resetFormBtn').addEventListener('click', resetForm);
  document.getElementById('syncBtn').addEventListener('click', () => {
    syncPostsToRemote().catch((error) => setLoginMessage(`同步失败：${error.message}`, 'error'));
  });
  document.getElementById('logoutBtn').addEventListener('click', logout);
  bindPostListEvents();
}

async function init() {
  hydrateLoginForm();
  renderConnectionStatus();
  renderStats();
  state.posts = DEFAULT_POSTS;
  renderPosts();
  populateForm(DEFAULT_POSTS[0]);
  state.selectedId = DEFAULT_POSTS[0].id;
  initEvents();

  if (state.config.token) {
    state.authenticated = true;
    toggleViews();
    renderConnectionStatus();
    try {
      await loadPostsFromRemote();
    } catch (error) {
      setLoginMessage(`初始化失败：${error.message}`, 'error');
    }
  } else {
    toggleViews();
  }
}

init();
