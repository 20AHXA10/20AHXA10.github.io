const BLOG_DATA_URL = '/data/posts.json';
const LIST_CONTAINER_ID = 'articleList';
const EMPTY_STATE_HTML = '<div class="blog-empty-state">暂无已发布文章。</div>';

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(dateString) {
  if (!dateString) return '未设置日期';
  const date = new Date(dateString + 'T00:00:00');
  if (Number.isNaN(date.getTime())) return '未设置日期';
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

function renderInlineMarkdown(rawText = '') {
  const escaped = escapeHtml(rawText);
  const htmlParts = [];
  const lines = escaped.split('\n');
  let paragraph = [];
  let listItems = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    htmlParts.push(`<p>${paragraph.join('<br>')}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!listItems.length) return;
    htmlParts.push(`<ul>${listItems.map((item) => `<li>${item}</li>`).join('')}</ul>`);
    listItems = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    if (/^#+\s+/.test(line)) {
      flushParagraph();
      flushList();
      const level = line.match(/^#+/)[0].length;
      const text = line.replace(/^#+\s+/, '');
      htmlParts.push(`<h${level}>${text}</h${level}>`);
      continue;
    }

    if (/^-\s+/.test(line)) {
      flushParagraph();
      listItems.push(line.replace(/^-\s+/, ''));
      continue;
    }

    if (/^>\s+/.test(line)) {
      flushParagraph();
      flushList();
      htmlParts.push(`<blockquote>${line.replace(/^>\s+/, '')}</blockquote>`);
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

  flushParagraph();
  flushList();

  return htmlParts.join('');
}

function loadPosts() {
  return fetch(BLOG_DATA_URL, { cache: 'no-store' })
    .then((response) => {
      if (!response.ok) {
        throw new Error('无法读取文章数据');
      }
      return response.json();
    })
    .then((posts) => Array.isArray(posts) ? posts : [])
    .then((posts) => posts.filter((post) => String(post.status || 'draft') === 'published'))
    .then((posts) => posts.sort((a, b) => new Date(b.date || '1970-01-01') - new Date(a.date || '1970-01-01')));
}

function renderList(posts) {
  const listNode = document.getElementById(LIST_CONTAINER_ID);
  if (!listNode) return;

  if (!posts.length) {
    listNode.innerHTML = EMPTY_STATE_HTML;
    return;
  }

  listNode.innerHTML = posts.map((post) => {
    const url = `${location.pathname}?post=${encodeURIComponent(post.id)}`;
    const subtitle = post.subtitle ? `<h3 class="article-subtitle">${escapeHtml(post.subtitle)}</h3>` : '';
    const category = post.category ? `<header class="article-category"><a href="${url}">${escapeHtml(post.category)}</a></header>` : '';

    return `
      <article class="">
        <header class="article-header">
          <div class="article-details">
            ${category}
            <div class="article-title-wrapper">
              <h2 class="article-title"><a href="${url}">${escapeHtml(post.title || '未命名文章')}</a></h2>
              ${subtitle}
            </div>
            <footer class="article-time">
              <div>
                <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-calendar-time" width="56" height="56" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <path stroke="none" d="M0 0h24v24H0z"/>
                  <path d="M11.795 21h-6.795a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v4" />
                  <circle cx="18" cy="18" r="4" />
                  <path d="M15 3v4" /><path d="M7 3v4" /><path d="M3 11h16" /><path d="M18 16.496v1.504l1 1" />
                </svg>
                <time class="article-time--published">${escapeHtml(formatDate(post.date))}</time>
              </div>
            </footer>
          </div>
        </header>
      </article>
    `;
  }).join('');
}

function renderDetail(post) {
  const listNode = document.getElementById(LIST_CONTAINER_ID);
  if (!listNode || !post) return;

  listNode.innerHTML = `
    <article class="blog-detail">
      <div class="blog-detail-header">
        <a href="${location.pathname}" class="blog-backlink">← 返回首页</a>
        <header class="article-category">
          <a href="${location.pathname}">${escapeHtml(post.category || '未分类')}</a>
        </header>
        <h1 class="article-title">${escapeHtml(post.title || '未命名文章')}</h1>
        ${post.subtitle ? `<h2 class="article-subtitle">${escapeHtml(post.subtitle)}</h2>` : ''}
        <p class="article-time--published">${escapeHtml(formatDate(post.date))}</p>
      </div>
      <div class="blog-content">${renderInlineMarkdown(post.content || '')}</div>
    </article>
  `;
}

function initBlog() {
  const postId = new URLSearchParams(window.location.search).get('post');
  loadPosts()
    .then((posts) => {
      if (postId) {
        const match = posts.find((post) => String(post.id) === String(postId));
        if (match) {
          renderDetail(match);
          return;
        }
      }
      renderList(posts);
    })
    .catch(() => {
      const listNode = document.getElementById(LIST_CONTAINER_ID);
      if (listNode) listNode.innerHTML = EMPTY_STATE_HTML;
    });
}

window.addEventListener('DOMContentLoaded', initBlog);
