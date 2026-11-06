/* Ícones em traço fino, no espírito dos SF Symbols. */
(function () {
  const P = {
    sparkle: '<path d="M12 3.5l1.7 4.8 4.8 1.7-4.8 1.7L12 16.5l-1.7-4.8L5.5 10l4.8-1.7z"/><path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
    tray: '<path d="M4 13.5l2.2-7.2A1.5 1.5 0 017.6 5.2h8.8a1.5 1.5 0 011.4 1.1L20 13.5V18a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 18z"/><path d="M4 13.5h4.5l1 2h5l1-2H20"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2L5.5 5.5"/><circle cx="12" cy="12" r="6.6"/>',
    film: '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="M8 5v14M16 5v14M3.5 9.5H8M3.5 14.5H8M16 9.5h4.5M16 14.5h4.5"/>',
    music: '<path d="M9 18V6.2l10-2.2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/><path d="M9 9.8l10-2.2"/>',
    folder: '<path d="M3.5 7.5A2 2 0 015.5 5.5h3.7l2 2h7.3a2 2 0 012 2v7.5a2 2 0 01-2 2h-13a2 2 0 01-2-2z"/>',
    link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1.2 1.2"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1.2-1.2"/>',
    clipboard: '<rect x="5.5" y="4.5" width="13" height="16" rx="2.5"/><path d="M9 4.5V4a1 1 0 011-1h4a1 1 0 011 1v.5a1 1 0 01-1 1h-4a1 1 0 01-1-1z"/>',
    'xmark-circle': '<circle cx="12" cy="12" r="8.5" fill="currentColor" stroke="none" opacity=".35"/><path d="M9.5 9.5l5 5M14.5 9.5l-5 5"/>',
    xmark: '<path d="M7 7l10 10M17 7L7 17"/>',
    warn: '<path d="M12 4l9 16H3z"/><path d="M12 10v4.5M12 17.2v.3"/>',
    photo: '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.7"/><path d="M4 17l5-4.5 3.5 3 3-2.5 4.5 4"/>',
    tag: '<path d="M3.5 12.3V5a1.5 1.5 0 011.5-1.5h7.3L20.5 11.7a1.5 1.5 0 010 2.1l-6.7 6.7a1.5 1.5 0 01-2.1 0z"/><circle cx="8" cy="8" r="1.5"/>',
    captions: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M10.5 10.3a2.2 2.2 0 100 3.4M17 10.3a2.2 2.2 0 100 3.4"/>',
    scissors: '<circle cx="6.5" cy="6.5" r="2.5"/><circle cx="6.5" cy="17.5" r="2.5"/><path d="M8.6 8l11 9M8.6 16l11-9"/>',
    timeline: '<path d="M3.5 12h17"/><rect x="7" y="8" width="10" height="8" rx="2"/><path d="M7 5v14M17 5v14"/>',
    'arrow-down': '<path d="M12 4.5v12m0 0l-5-5m5 5l5-5M5.5 20h13"/>',
    moon: '<path d="M19.5 14.5A8 8 0 019.5 4.5a8 8 0 1010 10z"/>',
    palette: '<path d="M12 3.5a8.5 8.5 0 000 17c1.2 0 1.8-.8 1.8-1.7 0-1.1-.9-1.5-.9-2.5 0-1 .8-1.8 1.8-1.8h2.1a3.7 3.7 0 003.7-3.7c0-4.2-3.8-7.3-8.5-7.3z"/><circle cx="7.8" cy="11" r="1.1"/><circle cx="10.5" cy="7.3" r="1.1"/><circle cx="15" cy="7.8" r="1.1"/>',
    stack: '<path d="M12 3.5l8.5 4.3L12 12 3.5 7.8z"/><path d="M3.5 12L12 16.3l8.5-4.3M3.5 16.2L12 20.5l8.5-4.3"/>',
    doc: '<path d="M6.5 3.5h7l4 4V19a1.5 1.5 0 01-1.5 1.5h-9.5A1.5 1.5 0 015 19V5a1.5 1.5 0 011.5-1.5z"/><path d="M13.5 3.5v4h4M8.5 12h7M8.5 15.5h5"/>',
    bell: '<path d="M6 16.5V11a6 6 0 0112 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 004 0"/>',
    cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9 3.5V6M15 3.5V6M9 18v2.5M15 18v2.5M3.5 9H6M3.5 15H6M18 9h2.5M18 15h2.5"/>',
    bolt: '<path d="M13 3L5 13.5h6L10.5 21 19 10.5h-6z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    'check-circle': '<circle cx="12" cy="12" r="8.5"/><path d="M8 12.3l2.7 2.7L16 9.6"/>',
    retry: '<path d="M4.5 12a7.5 7.5 0 0113-5.1L19.5 9M19.5 4.5V9H15M19.5 12a7.5 7.5 0 01-13 5.1L4.5 15M4.5 19.5V15H9"/>',
    search: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z"/>',
    trash: '<path d="M4.5 6.5h15M9.5 6.5V5a1.5 1.5 0 011.5-1.5h2A1.5 1.5 0 0114.5 5v1.5M6.5 6.5l.8 12.1a1.5 1.5 0 001.5 1.4h6.4a1.5 1.5 0 001.5-1.4l.8-12.1"/>',
    list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.8" cy="6.5" r="1" fill="currentColor"/><circle cx="4.8" cy="12" r="1" fill="currentColor"/><circle cx="4.8" cy="17.5" r="1" fill="currentColor"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    heart: '<path d="M12 19.5s-7.5-4.4-7.5-10A4.3 4.3 0 0112 7a4.3 4.3 0 017.5 2.5c0 5.6-7.5 10-7.5 10z"/>',
    calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
    github: '<path fill="currentColor" stroke="none" d="M12 2.5a9.5 9.5 0 00-3 18.5c.5.1.7-.2.7-.5v-1.7c-2.6.6-3.2-1.2-3.2-1.2-.4-1.1-1-1.4-1-1.4-.9-.6 0-.6 0-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.3-1.1.6-1.3-2.1-.2-4.3-1-4.3-4.7 0-1 .4-1.9 1-2.6-.1-.2-.4-1.2.1-2.5 0 0 .8-.3 2.6 1a9 9 0 014.8 0c1.8-1.3 2.6-1 2.6-1 .5 1.3.2 2.3.1 2.5.6.7 1 1.6 1 2.6 0 3.7-2.2 4.5-4.3 4.7.3.3.6.9.6 1.8v2.7c0 .3.2.6.7.5A9.5 9.5 0 0012 2.5z"/>',
    linkedin: '<path fill="currentColor" stroke="none" d="M5.5 3.5h13a2 2 0 012 2v13a2 2 0 01-2 2h-13a2 2 0 01-2-2v-13a2 2 0 012-2zm1.7 6.6v8h2.5v-8zm1.25-3.9a1.45 1.45 0 100 2.9 1.45 1.45 0 000-2.9zm3.25 3.9v8h2.5v-4.2c0-1.1.2-2.2 1.6-2.2s1.4 1.3 1.4 2.3v4.1h2.5v-4.6c0-2.3-.5-4-3.1-4-1.3 0-2.1.7-2.5 1.3v-1.1z"/>',
    key:'<circle cx="8" cy="15" r="4"/><path d="M11 12l8.5-8.5M16.5 6.5l2.5 2.5M14 9l2 2"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.7 5.4 3.7 8.5s-1.2 5.9-3.7 8.5c-2.5-2.6-3.7-5.4-3.7-8.5S9.5 6.1 12 3.5z"/>',
    shield: '<path d="M12 3.5l7 2.8v5.4c0 4.3-3 7.6-7 8.8-4-1.2-7-4.5-7-8.8V6.3z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
    clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  };

  window.icon = function (name, cls) {
    const body = P[name] || '';
    return `<svg class="ico ${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  };

  window.hydrateIcons = function (root) {
    (root || document).querySelectorAll('[data-icon]').forEach((el) => {
      if (el.dataset.iconDone) return;
      el.insertAdjacentHTML('afterbegin', window.icon(el.dataset.icon));
      el.dataset.iconDone = '1';
    });
  };
})();
