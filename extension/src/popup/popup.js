(() => {
  const defaults = {
    filterMode: 'dim',
    sensitivity: 'medium',
    enabled: true,
    whitelist: [],
    blocklist: []
  };

  let settings = { ...defaults };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  async function load() {
    const stored = await chrome.storage.local.get('desouperSettings');
    if (stored.desouperSettings) {
      settings = { ...defaults, ...stored.desouperSettings };
    }
    render();
  }

  async function save() {
    await chrome.storage.local.set({ desouperSettings: settings });
    // Reload active tab's content script by sending a message
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) chrome.tabs.reload(tab.id);
    } catch (e) {
      // Tab may not exist
    }
  }

  function render() {
    // Enabled toggle
    $('#enabled').checked = settings.enabled;

    // Filter mode buttons
    $$('#filter-mode button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === settings.filterMode);
    });

    // Sensitivity buttons
    $$('#sensitivity button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === settings.sensitivity);
    });

    // Whitelist
    renderList('whitelist', settings.whitelist, 'wl');

    // Blocklist
    renderList('blocklist', settings.blocklist, 'bl');
  }

  function renderList(id, items, tagClass) {
    const container = $(`#${id}-items`);
    container.innerHTML = '';
    items.forEach((name, i) => {
      const tag = document.createElement('span');
      tag.className = `list-tag list-tag-${tagClass}`;
      tag.innerHTML = `${name} <button data-list="${id}" data-index="${i}">\u00d7</button>`;
      container.appendChild(tag);
    });
  }

  // Event: enabled toggle
  $('#enabled').addEventListener('change', (e) => {
    settings.enabled = e.target.checked;
    save();
  });

  // Event: filter mode buttons
  $$('#filter-mode button').forEach(btn => {
    btn.addEventListener('click', () => {
      settings.filterMode = btn.dataset.value;
      render();
      save();
    });
  });

  // Event: sensitivity buttons
  $$('#sensitivity button').forEach(btn => {
    btn.addEventListener('click', () => {
      settings.sensitivity = btn.dataset.value;
      render();
      save();
    });
  });

  // Event: add to whitelist
  $('#whitelist-add').addEventListener('click', () => {
    const input = $('#whitelist-input');
    const val = input.value.trim();
    if (val && !settings.whitelist.includes(val)) {
      settings.whitelist.push(val);
      input.value = '';
      render();
      save();
    }
  });

  // Event: add to blocklist
  $('#blocklist-add').addEventListener('click', () => {
    const input = $('#blocklist-input');
    const val = input.value.trim();
    if (val && !settings.blocklist.includes(val)) {
      settings.blocklist.push(val);
      input.value = '';
      render();
      save();
    }
  });

  // Event: remove from list (delegated)
  document.addEventListener('click', (e) => {
    if (e.target.dataset.list && e.target.dataset.index !== undefined) {
      const list = e.target.dataset.list;
      const index = parseInt(e.target.dataset.index, 10);
      settings[list].splice(index, 1);
      render();
      save();
    }
  });

  // Enter key support for inputs
  $('#whitelist-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#whitelist-add').click();
  });

  $('#blocklist-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#blocklist-add').click();
  });

  load();
})();
