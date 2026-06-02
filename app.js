const routes = [
  {
    name: "Evening Park Loop",
    distance: "2.4 km",
    checkpoints: 5,
    lastWalked: "Yesterday",
    longest: "48 min",
    tone: "green"
  },
  {
    name: "Morning Sniff Route",
    distance: "1.8 km",
    checkpoints: 4,
    lastWalked: "Monday",
    longest: "36 min",
    tone: "amber"
  },
  {
    name: "Canal Calm Walk",
    distance: "3.1 km",
    checkpoints: 6,
    lastWalked: "Last week",
    longest: "1 hr 4 min",
    tone: "blue"
  }
];

const dogs = [
  {
    name: "Milo",
    breed: "Cocker Spaniel",
    birthday: "12 March 2021",
    age: "5 years",
    walks: 48,
    favourite: "Evening Park Loop",
    distance: "92 km",
    selected: true
  },
  {
    name: "Luna",
    breed: "Labrador",
    birthday: "4 July 2020",
    age: "5 years",
    walks: 32,
    favourite: "Morning Sniff Route",
    distance: "61 km",
    selected: false
  }
];

const screens = {
  map: document.getElementById("mapScreen"),
  routes: document.getElementById("routesScreen"),
  dogs: document.getElementById("dogsScreen"),
  account: document.getElementById("accountScreen")
};

const modalLayer = document.getElementById("modalLayer");
const toast = document.getElementById("toast");

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => switchTab(tab.dataset.tab));
});

document.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]");
  if (!action) return;
  const type = action.dataset.action;
  if (type === "create-route") showRouteModal();
  else if (type === "add-dog") showDogModal();
  else if (type === "confirm") showConfirmModal(action.dataset.title ?? "Design mockup");
  else if (type === "close-modal") closeModal();
  else showToast();
});

renderRoutes();
renderDogs();
renderAccount();

function switchTab(name) {
  Object.entries(screens).forEach(([key, screen]) => {
    screen.classList.toggle("active", key === name);
  });
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === name);
  });
}

function renderRoutes() {
  screens.routes.innerHTML = `
    <div class="screen-scroll">
      <header class="screen-header">
        <p class="eyebrow">Paws & Paths</p>
        <h2>Routes</h2>
        <p>Create and manage your walking paths.</p>
      </header>
      <button class="wide-action" data-action="create-route">
        <i class="fa-solid fa-plus"></i>
        Create New Route
      </button>
      <div class="card-list">
        ${routes.map(routeCard).join("")}
      </div>
    </div>
  `;
}

function routeCard(route) {
  return `
    <article class="route-card card">
      <div class="mini-map ${route.tone}">
        <svg viewBox="0 0 160 90" preserveAspectRatio="none">
          <path d="M12 66 C38 28, 66 76, 91 38 S132 20, 148 50" />
        </svg>
        <i class="fa-solid fa-route"></i>
      </div>
      <div class="card-main">
        <div class="card-title-row">
          <h3>${route.name}</h3>
          <div class="icon-pair">
            <button data-action="toast" aria-label="Edit route"><i class="fa-solid fa-pen"></i></button>
            <button data-action="confirm" data-title="Delete route?" aria-label="Delete route"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
        <div class="metric-row">
          <span><i class="fa-solid fa-person-walking"></i>${route.distance}</span>
          <span><i class="fa-solid fa-location-dot"></i>${route.checkpoints} stops</span>
        </div>
        <div class="metric-row muted-row">
          <span><i class="fa-solid fa-clock"></i>${route.longest}</span>
          <span>Last walked ${route.lastWalked}</span>
        </div>
      </div>
    </article>
  `;
}

function renderDogs() {
  screens.dogs.innerHTML = `
    <div class="screen-scroll">
      <header class="screen-header">
        <p class="eyebrow">Companions</p>
        <h2>Dogs</h2>
        <p>Manage dogs and walking stats.</p>
      </header>
      <button class="wide-action" data-action="add-dog">
        <i class="fa-solid fa-dog"></i>
        Add Dog
      </button>
      <div class="card-list">
        ${dogs.map(dogCard).join("")}
      </div>
    </div>
  `;
}

function dogCard(dog) {
  return `
    <article class="dog-card card ${dog.selected ? "selected" : ""}">
      <div class="dog-avatar"><i class="fa-solid fa-dog"></i></div>
      <div class="card-main">
        <div class="card-title-row">
          <div>
            <h3>${dog.name}</h3>
            <p>${dog.breed}</p>
          </div>
          ${dog.selected ? '<span class="selected-badge"><i class="fa-solid fa-circle-check"></i>Selected</span>' : '<button class="small-pill" data-action="toast">Select</button>'}
        </div>
        <div class="dog-grid">
          <span><i class="fa-solid fa-cake-candles"></i>${dog.birthday}</span>
          <span><i class="fa-solid fa-id-card"></i>${dog.age}</span>
          <span><i class="fa-solid fa-person-walking"></i>${dog.walks} walks</span>
          <span><i class="fa-solid fa-heart"></i>${dog.favourite}</span>
          <span><i class="fa-solid fa-chart-simple"></i>${dog.distance} total</span>
        </div>
      </div>
    </article>
  `;
}

function renderAccount() {
  screens.account.innerHTML = `
    <div class="screen-scroll">
      <header class="screen-header">
        <p class="eyebrow">Local profile</p>
        <h2>Account</h2>
        <p>Customise your local walking profile.</p>
      </header>
      <article class="profile-card card">
        <div class="profile-avatar"><i class="fa-solid fa-circle-user"></i></div>
        <div>
          <h3>Luke</h3>
          <p>Local walking profile</p>
        </div>
        <button class="small-pill" data-action="confirm" data-title="Edit profile?"><i class="fa-solid fa-pen"></i>Edit</button>
      </article>
      ${settingsSection("Profile", "fa-circle-user", [
        ["fa-pen", "Change name"],
        ["fa-image", "Change profile picture"]
      ])}
      ${settingsSection("App Preferences", "fa-gear", [
        ["fa-location-dot", "Default checkpoint radius"],
        ["fa-shoe-prints", "Preferred distance unit"],
        ["fa-moon", "Theme setting"],
        ["fa-person-running", "Reduce motion"]
      ])}
      ${settingsSection("Data Management", "fa-triangle-exclamation", [
        ["fa-rotate-left", "Reset walk history"],
        ["fa-route", "Reset routes"],
        ["fa-dog", "Reset dogs"],
        ["fa-trash", "Reset all local data"]
      ], true)}
    </div>
  `;
}

function settingsSection(title, icon, items, danger = false) {
  return `
    <section class="settings-section card">
      <h3><i class="fa-solid ${icon}"></i>${title}</h3>
      ${items.map(([itemIcon, label]) => `
        <button class="settings-row ${danger ? "danger-text" : ""}" data-action="confirm" data-title="${label}">
          <span><i class="fa-solid ${itemIcon}"></i>${label}</span>
          <i class="fa-solid fa-chevron-right"></i>
        </button>
      `).join("")}
    </section>
  `;
}

function showRouteModal() {
  showModal(`
    <section class="sheet">
      <header>
        <h2>Create Route</h2>
        <button data-action="close-modal" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
      </header>
      <label>Route name<input value="Sunny Park Loop" /></label>
      <div class="fake-list">
        <span><i class="fa-solid fa-flag"></i>Start</span>
        <span><i class="fa-solid fa-location-dot"></i>Park Gate</span>
        <span><i class="fa-solid fa-tree"></i>Big Tree</span>
      </div>
      <button class="secondary-action" data-action="toast"><i class="fa-solid fa-plus"></i>Add Checkpoint</button>
      <div class="sheet-actions">
        <button class="ghost-action" data-action="close-modal">Cancel</button>
        <button class="primary-action" data-action="close-modal">Save Route</button>
      </div>
    </section>
  `);
}

function showDogModal() {
  showModal(`
    <section class="sheet">
      <header>
        <h2>Add Dog</h2>
        <button data-action="close-modal" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
      </header>
      <label>Name<input value="Scout" /></label>
      <label>Breed<input value="Border Collie" /></label>
      <label>Birthday<input value="18 September 2022" /></label>
      <button class="secondary-action" data-action="toast"><i class="fa-solid fa-image"></i>Picture upload mock</button>
      <div class="sheet-actions">
        <button class="ghost-action" data-action="close-modal">Cancel</button>
        <button class="primary-action" data-action="close-modal">Save Dog</button>
      </div>
    </section>
  `);
}

function showConfirmModal(title) {
  showModal(`
    <section class="sheet compact-sheet">
      <div class="warning-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
      <h2>${title}</h2>
      <p>This is a visual prototype. No real data will be changed.</p>
      <button class="primary-action" data-action="close-modal">Got it</button>
    </section>
  `);
}

function showModal(markup) {
  modalLayer.innerHTML = `<div class="scrim" data-action="close-modal"></div>${markup}`;
  modalLayer.hidden = false;
}

function closeModal() {
  modalLayer.hidden = true;
  modalLayer.innerHTML = "";
}

function showToast() {
  toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.hidden = true;
  }, 1800);
}
