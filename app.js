document.addEventListener('DOMContentLoaded', () => {

  // === STORAGE MANAGER ===
  const StorageManager = {
    getProgress() {
      try {
        return JSON.parse(localStorage.getItem('flashcard-progress')) || {};
      } catch {
        return {};
      }
    },
    setCardStatus(cardId, status) {
      const progress = this.getProgress();
      progress[cardId] = status;
      localStorage.setItem('flashcard-progress', JSON.stringify(progress));
    },
    getCardStatus(cardId) {
      return this.getProgress()[cardId] || null;
    },
    clearProgress() {
      localStorage.removeItem('flashcard-progress');
    },
    getTheme() {
      return localStorage.getItem('flashcard-theme') || 'light';
    },
    setTheme(theme) {
      localStorage.setItem('flashcard-theme', theme);
    },
    getStats() {
      const progress = this.getProgress();
      let learned = 0;
      for (const key in progress) {
        if (progress[key] === 'learned') learned++;
      }
      return {
        totalLearned: learned,
        totalCards: typeof FLASHCARD_DATA !== 'undefined' ? FLASHCARD_DATA.length : 0
      };
    }
  };

  // === THEME MANAGER ===
  const ThemeManager = {
    init() {
      const theme = StorageManager.getTheme();
      this.applyTheme(theme);
      document.getElementById('theme-toggle').addEventListener('click', () => this.toggle());
    },
    applyTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      const icon = document.querySelector('.theme-icon');
      if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    },
    toggle() {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      this.applyTheme(next);
      StorageManager.setTheme(next);
      // Animate toggle button
      const btn = document.getElementById('theme-toggle');
      btn.style.transform = 'rotate(360deg) scale(1.2)';
      setTimeout(() => { btn.style.transform = ''; }, 400);
    }
  };

  // === SPEECH MANAGER ===
  const SpeechManager = {
    speak(text) {
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.85;
      // Try to find a good English voice
      const voices = window.speechSynthesis.getVoices();
      const enVoice = voices.find(v => v.lang.startsWith('en'));
      if (enVoice) utterance.voice = enVoice;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Preload voices
  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }

  // === CONFETTI EFFECT ===
  const ConfettiEffect = {
    launch() {
      const canvas = document.getElementById('confetti-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const particles = [];
      const colors = ['#6366f1', '#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6'];

      for (let i = 0; i < 150; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height * 0.3 - canvas.height * 0.1,
          r: Math.random() * 6 + 3,
          dx: (Math.random() - 0.5) * 6,
          dy: Math.random() * 3 + 2,
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 10,
          shape: Math.random() > 0.5 ? 'rect' : 'circle',
          opacity: 1
        });
      }

      let frame = 0;
      const maxFrames = 180; // ~3 seconds at 60fps

      function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        particles.forEach(p => {
          p.x += p.dx;
          p.y += p.dy;
          p.dy += 0.08; // gravity
          p.rotation += p.rotationSpeed;
          p.dx *= 0.99; // air resistance
          p.opacity = Math.max(0, 1 - (frame / maxFrames));

          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.globalAlpha = p.opacity;
          ctx.fillStyle = p.color;

          if (p.shape === 'rect') {
            ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.5);
          } else {
            ctx.beginPath();
            ctx.arc(0, 0, p.r / 2, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        });

        frame++;
        if (frame < maxFrames) {
          requestAnimationFrame(animate);
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      animate();
    }
  };

  // === UI UTILS ===
  const UI = {
    hideAllViews() {
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    },
    showView(id) {
      this.hideAllViews();
      const view = document.getElementById(id);
      if (view) {
        view.classList.add('active');
        // Re-trigger animation
        view.style.animation = 'none';
        view.offsetHeight; // force reflow
        view.style.animation = '';
      }
    },
    updateBreadcrumb(items) {
      const bc = document.getElementById('breadcrumb');
      if (!bc) return;
      bc.innerHTML = items.map((item, i) => {
        if (i === items.length - 1) return `<span>${item.text}</span>`;
        return `<a data-hash="${item.hash}">${item.text}</a> <span class="separator">›</span>`;
      }).join(' ');
      // Bind breadcrumb clicks
      bc.querySelectorAll('a[data-hash]').forEach(a => {
        a.addEventListener('click', (e) => {
          e.preventDefault();
          Router.navigate(a.dataset.hash);
        });
        a.style.cursor = 'pointer';
      });
    }
  };

  // === DASHBOARD RENDERER ===
  const Dashboard = {
    render() {
      UI.showView('dashboard-view');
      UI.updateBreadcrumb([{ text: '🏠 Ana Sayfa', hash: '#/' }]);

      if (typeof CATEGORIES === 'undefined' || typeof FLASHCARD_DATA === 'undefined') {
        console.warn('Data not loaded');
        return;
      }

      // Global Stats
      const stats = StorageManager.getStats();
      const pct = stats.totalCards > 0 ? Math.round((stats.totalLearned / stats.totalCards) * 100) : 0;
      document.getElementById('global-stats').innerHTML = `
        <div class="stat-card">
          <h3>${stats.totalLearned}</h3>
          <p>Öğrenilen</p>
        </div>
        <div class="stat-card">
          <h3>${stats.totalCards}</h3>
          <p>Toplam Kart</p>
        </div>
        <div class="stat-card">
          <h3>%${pct}</h3>
          <p>İlerleme</p>
        </div>
      `;

      // Category Colors for left border
      const catColors = ['#6366f1', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444'];

      // Categories
      const grid = document.getElementById('category-grid');
      grid.innerHTML = '';

      CATEGORIES.forEach((cat, index) => {
        const catCards = FLASHCARD_DATA.filter(c => c.category === cat.id);
        const cardCount = catCards.length;

        let learnedInCat = 0;
        catCards.forEach(c => {
          if (StorageManager.getCardStatus(c.id) === 'learned') learnedInCat++;
        });
        const percent = cardCount === 0 ? 0 : Math.round((learnedInCat / cardCount) * 100);

        // Count available sets
        const availableSets = new Set(catCards.map(c => c.deck)).size;

        const el = document.createElement('div');
        el.className = 'category-card';
        el.style.borderLeftColor = catColors[index % catColors.length];
        el.style.animationDelay = `${index * 80}ms`;
        el.style.opacity = '0';
        el.style.animation = `slideUp 0.5s ease-out ${index * 80}ms forwards`;

        el.innerHTML = `
          <div class="category-card-icon">${cat.icon}</div>
          <div class="category-card-title">${cat.name}</div>
          <div class="category-card-desc">${cat.description}</div>
          <div class="category-card-meta">
            <span>${cardCount} Kart</span>
            <span>${availableSets} / ${cat.totalSets} Set</span>
          </div>
          <div class="category-progress-bar">
            <div class="category-progress-fill" style="width: ${percent}%"></div>
          </div>
          <div class="category-card-footer">
            <span>${learnedInCat} / ${cardCount} öğrenildi</span>
            <span class="category-pct">%${percent}</span>
          </div>
        `;
        el.addEventListener('click', () => Router.navigate(`#/category/${cat.id}`));
        grid.appendChild(el);
      });
    }
  };

  // === CATEGORY RENDERER ===
  const CategoryView = {
    render(categoryId) {
      if (typeof CATEGORIES === 'undefined' || typeof FLASHCARD_DATA === 'undefined') return;
      const cat = CATEGORIES.find(c => c.id === categoryId);
      if (!cat) return Router.navigate('#/');

      UI.showView('category-view');
      UI.updateBreadcrumb([
        { text: '🏠 Ana Sayfa', hash: '#/' },
        { text: `${cat.icon} ${cat.name}`, hash: `#/category/${cat.id}` }
      ]);

      document.getElementById('category-icon').textContent = cat.icon;
      document.getElementById('category-title').textContent = cat.name;
      document.getElementById('category-description').textContent = cat.description;

      const grid = document.getElementById('sets-grid');
      grid.innerHTML = '';

      for (let i = 1; i <= cat.totalSets; i++) {
        const deckCards = FLASHCARD_DATA.filter(c => c.category === cat.id && c.deck === i);
        const hasData = deckCards.length > 0;

        const el = document.createElement('div');
        el.className = 'set-card';
        el.style.opacity = '0';
        el.style.animation = `slideUp 0.4s ease-out ${(i - 1) * 40}ms forwards`;

        if (hasData) {
          let learned = 0;
          deckCards.forEach(c => {
            if (StorageManager.getCardStatus(c.id) === 'learned') learned++;
          });
          const percent = Math.round((learned / deckCards.length) * 100);

          if (percent === 100) el.classList.add('completed');
          else if (percent > 0) el.classList.add('has-progress');

          el.innerHTML = `
            <div class="set-number">Set ${i}</div>
            <div class="set-count">${deckCards.length} Kart</div>
            <div class="set-progress-bar">
              <div class="set-progress-fill" style="width: ${percent}%"></div>
            </div>
            <div class="set-pct">%${percent}</div>
          `;
          el.addEventListener('click', () => Router.navigate(`#/study/${cat.id}/${i}`));
        } else {
          el.classList.add('disabled');
          el.innerHTML = `
            <div class="set-number" style="color:var(--text-secondary);">Set ${i}</div>
            <div class="set-count disabled-text">Yakında</div>
          `;
        }
        grid.appendChild(el);
      }

      document.getElementById('back-to-dashboard').onclick = () => Router.navigate('#/');
    }
  };

  // === FLASHCARD ENGINE ===
  const FlashcardEngine = {
    currentCards: [],
    currentIndex: 0,
    categoryId: null,
    deckNumber: null,
    _bound: false,

    start(categoryId, deckNumber) {
      if (typeof CATEGORIES === 'undefined' || typeof FLASHCARD_DATA === 'undefined') return;
      deckNumber = parseInt(deckNumber);
      const cat = CATEGORIES.find(c => c.id === categoryId);
      if (!cat) return Router.navigate('#/');

      this.currentCards = FLASHCARD_DATA.filter(c => c.category === categoryId && c.deck === deckNumber);
      if (this.currentCards.length === 0) return Router.navigate(`#/category/${categoryId}`);

      this.categoryId = categoryId;
      this.deckNumber = deckNumber;
      this.currentIndex = 0;

      UI.showView('study-view');
      UI.updateBreadcrumb([
        { text: '🏠 Ana Sayfa', hash: '#/' },
        { text: `${cat.icon} ${cat.name}`, hash: `#/category/${cat.id}` },
        { text: `Set ${deckNumber}`, hash: `#/study/${categoryId}/${deckNumber}` }
      ]);

      document.getElementById('study-category-title').textContent = cat.name;
      document.getElementById('study-set-title').textContent = `Set ${deckNumber}`;
      document.getElementById('back-to-category').onclick = () => Router.navigate(`#/category/${categoryId}`);

      if (!this._bound) {
        this.bindEvents();
        this._bound = true;
      }

      this.renderCard();
    },

    renderCard() {
      const card = this.currentCards[this.currentIndex];
      if (!card) return;

      const fc = document.getElementById('flashcard');
      fc.classList.remove('flipped');

      // Front
      document.getElementById('card-type').textContent = card.type === 'chunk' ? 'KALIP' : 'KELİME';
      document.getElementById('card-expression').textContent = card.target_expression;
      document.getElementById('card-pronunciation').textContent = card.pronunciation || '';
      document.getElementById('card-example-en').textContent = card.example_en || '';

      // Back
      document.getElementById('card-meaning').textContent = card.turkish_meaning;
      document.getElementById('card-keyword').textContent = '🔑 ' + (card.key_word || '');
      document.getElementById('card-example-tr').textContent = card.example_tr || '';

      // Progress
      const percent = ((this.currentIndex + 1) / this.currentCards.length) * 100;
      document.getElementById('progress-fill').style.width = `${percent}%`;
      document.getElementById('progress-text').textContent = `${this.currentIndex + 1} / ${this.currentCards.length} Kart`;

      // Button states
      document.getElementById('prev-btn').disabled = this.currentIndex === 0;

      // Visual card status
      const status = StorageManager.getCardStatus(card.id);
      const container = document.getElementById('flashcard-container');
      container.classList.remove('status-learned', 'status-repeat');
      if (status === 'learned') container.classList.add('status-learned');
      else if (status === 'repeat') container.classList.add('status-repeat');

      // Update button visual states
      const learnedBtn = document.getElementById('learned-btn');
      const repeatBtn = document.getElementById('repeat-btn');
      learnedBtn.classList.toggle('active-status', status === 'learned');
      repeatBtn.classList.toggle('active-status', status === 'repeat');
    },

    bindEvents() {
      // Flashcard flip
      document.getElementById('flashcard').addEventListener('click', (e) => {
        // Don't flip when clicking speak button
        if (e.target.closest('#speak-btn')) return;
        document.getElementById('flashcard').classList.toggle('flipped');
      });

      // Speak button
      document.getElementById('speak-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const c = this.currentCards[this.currentIndex];
        if (c) {
          SpeechManager.speak(c.target_expression + '. ' + (c.example_en || ''));
        }
        // Visual feedback
        const btn = e.currentTarget;
        btn.style.transform = 'scale(1.2)';
        setTimeout(() => { btn.style.transform = ''; }, 200);
      });

      // Navigation
      document.getElementById('prev-btn').addEventListener('click', () => this.prev());
      document.getElementById('next-btn').addEventListener('click', () => this.next());

      // Learned/Repeat
      document.getElementById('learned-btn').addEventListener('click', () => {
        const card = this.currentCards[this.currentIndex];
        if (!card) return;
        StorageManager.setCardStatus(card.id, 'learned');
        // Visual flash
        this.flashFeedback('learned');
        this.renderCard();
        setTimeout(() => this.next(true), 400);
      });

      document.getElementById('repeat-btn').addEventListener('click', () => {
        const card = this.currentCards[this.currentIndex];
        if (!card) return;
        StorageManager.setCardStatus(card.id, 'repeat');
        this.flashFeedback('repeat');
        this.renderCard();
        setTimeout(() => this.next(true), 400);
      });

      // Touch/Swipe handling
      let touchStartX = 0;
      let touchStartY = 0;
      const container = document.getElementById('flashcard-container');

      container.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
      }, { passive: true });

      container.addEventListener('touchend', (e) => {
        const dx = e.changedTouches[0].screenX - touchStartX;
        const dy = e.changedTouches[0].screenY - touchStartY;
        // Only trigger swipe if horizontal movement > vertical
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60) {
          if (dx < 0) this.next();
          else this.prev();
        }
      }, { passive: true });

      // Modal buttons
      document.getElementById('modal-retry').addEventListener('click', () => {
        document.getElementById('completion-modal').classList.remove('active');
        this.currentIndex = 0;
        this.renderCard();
      });

      document.getElementById('modal-home').addEventListener('click', () => {
        document.getElementById('completion-modal').classList.remove('active');
        Router.navigate('#/');
      });

      document.getElementById('modal-next').addEventListener('click', () => {
        document.getElementById('completion-modal').classList.remove('active');
        // Check if next deck has data
        const nextDeck = this.deckNumber + 1;
        const nextCards = FLASHCARD_DATA.filter(c => c.category === this.categoryId && c.deck === nextDeck);
        if (nextCards.length > 0) {
          Router.navigate(`#/study/${this.categoryId}/${nextDeck}`);
        } else {
          Router.navigate(`#/category/${this.categoryId}`);
        }
      });
    },

    flashFeedback(type) {
      const fc = document.getElementById('flashcard');
      fc.classList.add(`flash-${type}`);
      setTimeout(() => fc.classList.remove(`flash-${type}`), 500);
    },

    prev() {
      if (this.currentIndex > 0) {
        this.currentIndex--;
        this.renderCard();
      }
    },

    next(fromAction = false) {
      if (this.currentIndex < this.currentCards.length - 1) {
        this.currentIndex++;
        this.renderCard();
      } else if (fromAction) {
        this.showCompletion();
      }
    },

    showCompletion() {
      let learned = 0;
      let repeat = 0;

      this.currentCards.forEach(c => {
        const status = StorageManager.getCardStatus(c.id);
        if (status === 'learned') learned++;
        else if (status === 'repeat') repeat++;
      });

      const pct = Math.round((learned / this.currentCards.length) * 100);

      document.getElementById('completion-message').textContent =
        `Set ${this.deckNumber}'i tamamladınız!`;

      document.getElementById('completion-stats').innerHTML = `
        <div class="completion-stat">
          <div class="completion-stat-number success">${learned}</div>
          <div class="completion-stat-label">Öğrenildi</div>
        </div>
        <div class="completion-stat">
          <div class="completion-stat-number danger">${repeat}</div>
          <div class="completion-stat-label">Tekrar</div>
        </div>
        <div class="completion-stat">
          <div class="completion-stat-number accent">%${pct}</div>
          <div class="completion-stat-label">Başarı</div>
        </div>
      `;

      document.getElementById('completion-modal').classList.add('active');
      ConfettiEffect.launch();
    }
  };

  // === ROUTER ===
  const Router = {
    init() {
      window.addEventListener('hashchange', () => this.handleRoute());
      this.handleRoute();
    },
    navigate(hash) {
      window.location.hash = hash;
    },
    handleRoute() {
      const hash = window.location.hash || '#/';

      // Close modal on navigation
      document.getElementById('completion-modal').classList.remove('active');

      if (hash === '#/' || hash === '' || hash === '#') {
        Dashboard.render();
      } else if (hash.startsWith('#/category/')) {
        const id = hash.split('/')[2];
        if (id) CategoryView.render(id);
        else Dashboard.render();
      } else if (hash.startsWith('#/study/')) {
        const parts = hash.split('/');
        if (parts[2] && parts[3]) FlashcardEngine.start(parts[2], parts[3]);
        else Dashboard.render();
      } else {
        Dashboard.render();
      }
    }
  };

  // === GLOBAL KEYBOARD SHORTCUTS ===
  window.addEventListener('keydown', (e) => {
    const studyActive = document.getElementById('study-view').classList.contains('active');
    if (!studyActive) return;

    const modalActive = document.getElementById('completion-modal').classList.contains('active');
    if (modalActive) return;

    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        FlashcardEngine.next();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        FlashcardEngine.prev();
        break;
      case ' ':
        e.preventDefault();
        document.getElementById('flashcard').classList.toggle('flipped');
        break;
      case 'Enter':
        e.preventDefault();
        document.getElementById('learned-btn').click();
        break;
    }
  });

  // === INIT ===
  ThemeManager.init();
  Router.init();
});
