const STORAGE_KEY = 'aguagua-blog-admin-posts';

const defaultPosts = [
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
    content: '## CsBlog\n\n这是一个用于测试博客后台的示例文章。\n\n- 可编辑标题\n- 可切换状态\n- 可预览内容\n\n> 后台是静态界面，数据会保存在浏览器本地。'
  }
];

const state = {
  posts: loadPosts(),
  selectedId: null
};

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

function loadPosts() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultPosts));
    return structuredClone(defaultPosts);
  }

  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) && parsed.length ? parsed : defaultPosts;
  } catch (error) {
    console.warn('读取文章列表失败，使用默认数据。', error);
    return structuredClone(defaultPosts);
  }
}

function savePosts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.posts));
}

function getSelectedPost() {
  return state.posts.find((post) => post.id === state.selectedId) || null;
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

  const flushList = () => {
    if (listBuffer.length) {
      html.push(`<ul>${listBuffer.map((item) => `<li>${item}</li>`).join('')}</ul>`);
      listBuffer = [];
    }
  };

  const flushParagraph = (paragraphLines) => {
    if (!paragraphLines.length) return;
    const text = paragraphLines.join('<br>');
    html.push(`<p>${text}</p>`);
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
  const content = form.content.value.trim();
  const status = form.status.value;
  previewLabel.textContent = status === 'published' ? '已发布' : '草稿';

  if (!title && !content) {
    preview.innerHTML = '<p>写点内容后，这里会实时预览。</p>';
    return;
  }

  const titleHtml = title ? `<h2>${escapeHtml(title)}</h2>` : '';
  const subtitleHtml = form.subtitle.value.trim() ? `<p><strong>${escapeHtml(form.subtitle.value.trim())}</strong></p>` : '';
  const categoryHtml = form.category.value.trim() ? `<p><small>分类：${escapeHtml(form.category.value.trim())}</small></p>` : '';
  const dateHtml = form.date.value ? `<p><small>日期：${escapeHtml(form.date.value)}</small></p>` : '';
  preview.innerHTML = `${titleHtml}${subtitleHtml}${categoryHtml}${dateHtml}${renderMarkdown(content)}`;
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

function saveCurrentPost() {
  const title = form.title.value.trim();
  const content = form.content.value.trim();

  if (!title || !content) {
    alert('标题和正文不能为空。');
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

  savePosts();
  renderStats();
  renderPosts();
  populateForm(payload);
}

function togglePostStatus(id) {
  state.posts = state.posts.map((post) => {
    if (post.id !== id) return post;
    return { ...post, status: post.status === 'published' ? 'draft' : 'published' };
  });
  savePosts();
  renderStats();
  renderPosts();

  const selected = getSelectedPost();
  if (selected) {
    populateForm(selected);
  }
}

function deletePost(id) {
  const target = state.posts.find((post) => post.id === id);
  if (!target) return;

  const confirmed = window.confirm(`确认删除文章“${target.title}”？`);
  if (!confirmed) return;

  state.posts = state.posts.filter((post) => post.id !== id);
  savePosts();
  renderStats();
  renderPosts();

  if (state.selectedId === id) {
    resetForm();
  }
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

function initEvents() {
  Object.values(form).forEach((field) => {
    field.addEventListener('input', renderPreview);
    field.addEventListener('change', renderPreview);
  });

  document.getElementById('saveBtn').addEventListener('click', saveCurrentPost);
  document.getElementById('newPostBtn').addEventListener('click', resetForm);
  document.getElementById('resetFormBtn').addEventListener('click', resetForm);
  bindPostListEvents();
}

function init() {
  form.date.value = new Date().toISOString().slice(0, 10);
  renderStats();
  renderPosts();
  populateForm(state.posts[0] || null);
  if (state.posts[0]) {
    state.selectedId = state.posts[0].id;
  }
  initEvents();
}

init();
