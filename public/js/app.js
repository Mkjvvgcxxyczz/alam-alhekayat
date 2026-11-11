
const categories = [
"الحب والرومانسية","الخيانة والغدر","الفراق والاشتياق",
"الانتقام","الرعب والغموض","الجرائم والتحقيق",
"الخيال العلمي","المغامرات","قصص واقعية","قصص حزينة",
"الصداقة والوفاء","العائلة","قصص تاريخية","قصص إسلامية",
"التشويق والإثارة","المافيا والعصابات","النجاح والطموح",
"قصص الأطفال","قصص قصيرة","روايات طويلة",
"المدرسة والجامعة","قصص اجتماعية"
];

let allStories = [];

async function loadApp() {
  try {
    const response = await fetch('/api/stories');
    allStories = await response.json();
    renderStories(allStories);

    const settings = await fetch('/api/settings').then(r => r.json());
    document.getElementById('tickerText').textContent =
      settings.ticker || 'مرحباً بكم في عالم الحكايات';
    applyBackground(settings.background);

  } catch (error) {
    document.getElementById('stories').innerHTML =
      '<p>تعذر تحميل القصص. حاول تحديث الصفحة.</p>';
  }
}

function renderCategories() {
  const container = document.getElementById('categories');
  container.innerHTML = categories.map((name, index) => `
    <div class="category" onclick="filterCategory(${index})">
      ✦ ${name} ✦
    </div>
  `).join('');
}

function renderStories(stories) {
  const container = document.getElementById('stories');

  if (!stories.length) {
    container.innerHTML = '<p>لا توجد قصص حالياً.</p>';
    return;
  }

  container.innerHTML = stories.map(story => `
    <div class="story">
      <h3>${escapeHTML(story.title)}</h3>
      <p>${escapeHTML(story.description || '')}</p>
      <button onclick="readStory(${Number(story.id)})">
        اقرأ القصة
      </button>
    </div>
  `).join('');
}

function filterCategory(index) {
  const selected = categories[index];
  renderStories(allStories.filter(s => s.category === selected));
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function readStory(id) {
  const story = allStories.find(s => Number(s.id) === id);
  if (!story) return;

  let modal = document.getElementById('readerModal');

  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'readerModal';
    modal.className = 'admin-panel';
    document.body.appendChild(modal);
  }

  const chapters = Array.isArray(story.chapters) && story.chapters.length
    ? story.chapters
    : [{title: 'النص الكامل', content: story.content || 'سيتم إضافة الفصول قريباً'}];

  let currentChapter = 0;

  function renderChapter() {
    const chapter = chapters[currentChapter];

    modal.innerHTML = `
      <div class="admin-box">
        <button id="closeReader">إغلاق</button>
        <h2>${escapeHTML(story.title)}</h2>
        <p>${escapeHTML(story.description || '')}</p>
        <hr>
        <h3 style="text-align:center;margin-top:20px">
          ${escapeHTML(chapter.title || 'الفصل ' + (currentChapter + 1))}
        </h3>
        <div style="white-space:pre-wrap;line-height:2.2;margin-top:20px;text-align:right">
          ${escapeHTML(chapter.content || '')}
        </div>
        <hr>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:20px">
          <button id="prevChapter" ${currentChapter === 0 ? 'disabled' : ''}>الفصل السابق</button>
          <span>الفصل ${currentChapter + 1} من ${chapters.length}</span>
          <button id="nextChapter" ${currentChapter === chapters.length - 1 ? 'disabled' : ''}>الفصل التالي</button>
        </div>
      </div>
    `;

    modal.querySelector('#closeReader').addEventListener('click', () => modal.remove());

    modal.querySelector('#prevChapter').addEventListener('click', () => {
      if (currentChapter > 0) {
        currentChapter--;
        renderChapter();
      }
    });

    modal.querySelector('#nextChapter').addEventListener('click', () => {
      if (currentChapter < chapters.length - 1) {
        currentChapter++;
        renderChapter();
      }
    });
  }

  renderChapter();
}

function openAdmin() {
  document.getElementById('adminPanel').classList.remove('hidden');
}

function closeAdmin() {
  document.getElementById('adminPanel').classList.add('hidden');
}

async function loginAdmin() {
  const username = document.getElementById('adminUser').value;
  const password = document.getElementById('adminPass').value;

  try {
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({username, password})
    });

    const result = await response.json();

    if (!response.ok) throw new Error(result.message);

    document.getElementById('adminTools').classList.remove('hidden');
    renderAdminStories();
    alert('تم تسجيل دخول المدير بنجاح');
  } catch (error) {
    alert(error.message || 'تعذر تسجيل الدخول');
  }
}


function applyBackground(url) {
  if (!url) return;
  document.body.style.backgroundImage =
    'linear-gradient(rgba(9,9,9,.78), rgba(9,9,9,.84)), url("' + url + '")';
  document.body.style.backgroundSize = 'cover';
  document.body.style.backgroundPosition = 'center';
  document.body.style.backgroundAttachment = 'fixed';
}

function previewBackground() {
  const file = document.getElementById('backgroundFile').files[0];
  const preview = document.getElementById('backgroundPreview');
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    alert('حجم الصورة أكبر من 5 ميغابايت');
    document.getElementById('backgroundFile').value = '';
    preview.classList.add('hidden');
    return;
  }
  preview.src = URL.createObjectURL(file);
  preview.classList.remove('hidden');
}

async function uploadBackground() {
  const input = document.getElementById('backgroundFile');
  const file = input.files[0];
  if (!file) {
    alert('اختر صورة من معرض الهاتف أولاً');
    return;
  }

  const data = new FormData();
  data.append('background', file);

  try {
    const response = await fetch('/api/admin/background', {
      method: 'POST',
      body: data
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'تعذر رفع الصورة');

    applyBackground(result.background);
    alert('تم تغيير خلفية التطبيق بنجاح');
    input.value = '';
    document.getElementById('backgroundPreview').classList.add('hidden');
  } catch (error) {
    alert(error.message || 'حدث خطأ أثناء رفع الصورة');
  }
}

async function saveTicker() {
  const ticker = document.getElementById('newTicker').value;

  const response = await fetch('/api/admin/settings', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ticker})
  });

  if (response.ok) {
    document.getElementById('tickerText').textContent = ticker;
    alert('تم حفظ الشريط المتحرك');
  } else {
    alert('تعذر الحفظ. تحقق من تسجيل دخول المدير.');
  }
}

function renderAdminStories() {
  const container = document.getElementById('adminStories');
  if (!container) return;

  if (!allStories.length) {
    container.innerHTML = '<p>لا توجد قصص لإدارتها حالياً.</p>';
    return;
  }

  container.innerHTML = allStories.map(story => `
    <div class="story">
      <h4>${escapeHTML(story.title)}</h4>
      <p>${escapeHTML(story.category || '')}</p>
      <button onclick="deleteStory(${Number(story.id)})">حذف القصة</button>
    </div>
  `).join('');
}

async function deleteStory(id) {
  if (!confirm('هل تريد حذف هذه القصة؟')) return;

  const response = await fetch('/api/admin/stories/' + id, {
    method: 'DELETE'
  });

  if (response.ok) {
    await loadApp();
    renderAdminStories();
    alert('تم حذف القصة');
  } else {
    alert('تعذر الحذف. تأكد من تسجيل دخول المدير.');
  }
}

async function addStory() {
  const title = document.getElementById('storyTitle').value.trim();
  const description = document.getElementById('storyDesc').value.trim();
  const content = document.getElementById('storyContent').value.trim();
  const category = document.getElementById('storyCategory').value;

  if (!title || !content || !category) {
    alert('أدخل عنوان القصة ومحتواها واختر القسم');
    return;
  }

  const response = await fetch('/api/admin/stories', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ title, description, content, category })
  });

  if (response.ok) {
    alert('تمت إضافة القصة إلى قسم ' + category);
    document.getElementById('storyTitle').value = '';
    document.getElementById('storyDesc').value = '';
    document.getElementById('storyContent').value = '';
    document.getElementById('storyCategory').value = '';
    await loadApp();
    renderAdminStories();
  } else {
    alert('تعذرت إضافة القصة. تحقق من تسجيل دخول المدير.');
  }
}

document.getElementById('searchInput').addEventListener('input', event => {
  const term = event.target.value.trim().toLowerCase();

  renderStories(allStories.filter(story =>
    story.title.toLowerCase().includes(term) ||
    (story.description || '').toLowerCase().includes(term)
  ));
});

renderCategories();
loadApp();

