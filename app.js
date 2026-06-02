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

const DOG_STORAGE_KEY = "paws-paths:prototype-dogs";
let dogs = loadDogs();

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
  else if (type === "edit-dog") showDogModal(action.dataset.id);
  else if (type === "delete-dog") showDeleteDogModal(action.dataset.id);
  else if (type === "confirm-delete-dog") deleteDog(action.dataset.id);
  else if (type === "select-dog") selectDog(action.dataset.id);
  else if (type === "confirm") showConfirmModal(action.dataset.title ?? "Design mockup");
  else if (type === "close-modal") closeModal();
  else showToast();
});

document.addEventListener("submit", async (event) => {
  const form = event.target.closest("#dogForm");
  if (!form) return;
  event.preventDefault();
  await saveDogFromForm(form);
});

document.addEventListener("change", async (event) => {
  if (event.target.id !== "dogPhoto") return;
  const preview = document.getElementById("dogPhotoPreview");
  const photoData = document.getElementById("dogPhotoData");
  const file = event.target.files?.[0];
  if (!file) return;
  const dataUrl = await readFileAsDataUrl(file);
  photoData.value = dataUrl;
  preview.innerHTML = `<img src="${dataUrl}" alt="Selected dog photo preview" />`;
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
  const dogMarkup = dogs.length
    ? dogs.map(dogCard).join("")
    : `
      <article class="empty-state card">
        <div class="empty-icon"><i class="fa-solid fa-dog"></i></div>
        <h3>No dogs yet</h3>
        <p>Add your first dog to choose who is going for a walk.</p>
        <button class="primary-action" data-action="add-dog"><i class="fa-solid fa-plus"></i>Add Dog</button>
      </article>
    `;
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
        ${dogMarkup}
      </div>
    </div>
  `;
}

function dogCard(dog) {
  return `
    <article class="dog-card card ${dog.selected ? "selected" : ""}">
      <div class="dog-avatar">${dog.photo ? `<img src="${dog.photo}" alt="${escapeHtml(dog.name)} profile photo" />` : '<i class="fa-solid fa-dog"></i>'}</div>
      <div class="card-main">
        <div class="card-title-row">
          <div>
            <h3>${escapeHtml(dog.name)}</h3>
            <p>${escapeHtml(dog.breed)}</p>
          </div>
          ${dog.selected ? '<span class="selected-badge"><i class="fa-solid fa-circle-check"></i>Selected</span>' : `<button class="small-pill" data-action="select-dog" data-id="${dog.id}">Select</button>`}
        </div>
        <div class="dog-grid">
          <span><i class="fa-solid fa-cake-candles"></i>${formatBirthday(dog.birthday)}</span>
          <span><i class="fa-solid fa-id-card"></i>${dogAge(dog.birthday)}</span>
          <span><i class="fa-solid fa-person-walking"></i>${dog.totalWalks} walks</span>
          <span><i class="fa-solid fa-heart"></i>${escapeHtml(dog.favouriteRoute || "No favourite yet")}</span>
          <span><i class="fa-solid fa-chart-simple"></i>${formatDogDistance(dog.totalDistance)} total</span>
        </div>
        <div class="dog-actions">
          <button class="small-pill" data-action="edit-dog" data-id="${dog.id}"><i class="fa-solid fa-pen"></i>Edit</button>
          <button class="small-pill danger-pill" data-action="delete-dog" data-id="${dog.id}"><i class="fa-solid fa-trash"></i>Delete</button>
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

function showDogModal(id = null) {
  const dog = dogs.find((item) => item.id === id);
  const isEditing = Boolean(dog);
  showModal(`
    <section class="sheet">
      <header>
        <h2>${isEditing ? "Edit Dog" : "Add Dog"}</h2>
        <button data-action="close-modal" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
      </header>
      <form id="dogForm" class="dog-form">
        <input type="hidden" name="id" value="${dog?.id ?? ""}" />
        <input type="hidden" id="dogPhotoData" name="photo" value="${dog?.photo ?? ""}" />
        <label class="photo-upload">
          <span id="dogPhotoPreview" class="photo-preview">
            ${dog?.photo ? `<img src="${dog.photo}" alt="${escapeHtml(dog.name)} profile photo" />` : '<i class="fa-solid fa-image"></i>'}
          </span>
          <span><i class="fa-solid fa-camera"></i>${dog?.photo ? "Change photo" : "Upload photo"}</span>
          <input id="dogPhoto" type="file" accept="image/*" />
        </label>
        <label>Name<input name="name" value="${escapeHtml(dog?.name ?? "")}" placeholder="Milo" required /></label>
        <label>Breed<input name="breed" value="${escapeHtml(dog?.breed ?? "")}" placeholder="Cocker Spaniel" required /></label>
        <label>Birthday<input name="birthday" type="date" value="${dog?.birthday ?? ""}" required /></label>
        <label>Favourite route<input name="favouriteRoute" value="${escapeHtml(dog?.favouriteRoute ?? "")}" placeholder="Evening Park Loop" /></label>
        <div class="split-fields">
          <label>Total walks<input name="totalWalks" type="number" min="0" value="${dog?.totalWalks ?? 0}" /></label>
          <label>Total distance (km)<input name="totalDistance" type="number" min="0" step="0.1" value="${dog?.totalDistance ?? 0}" /></label>
        </div>
        <div class="sheet-actions">
          <button class="ghost-action" type="button" data-action="close-modal">Cancel</button>
          <button class="primary-action" type="submit">${isEditing ? "Save Changes" : "Save Dog"}</button>
        </div>
      </form>
    </section>
  `);
}

function showDeleteDogModal(id) {
  const dog = dogs.find((item) => item.id === id);
  if (!dog) return;
  showModal(`
    <section class="sheet compact-sheet">
      <div class="warning-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
      <h2>Delete ${escapeHtml(dog.name)}?</h2>
      <p>This removes the dog profile from local storage.</p>
      <div class="sheet-actions">
        <button class="ghost-action" data-action="close-modal">Cancel</button>
        <button class="primary-action danger-action" data-action="confirm-delete-dog" data-id="${dog.id}">Delete Dog</button>
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

async function saveDogFromForm(form) {
  const formData = new FormData(form);
  const id = formData.get("id") || createId();
  const existing = dogs.find((dog) => dog.id === id);
  const nextDog = {
    id,
    name: String(formData.get("name")).trim(),
    breed: String(formData.get("breed")).trim(),
    birthday: String(formData.get("birthday")),
    photo: String(formData.get("photo") || ""),
    totalWalks: Number(formData.get("totalWalks") || 0),
    favouriteRoute: String(formData.get("favouriteRoute") || "").trim(),
    totalDistance: Number(formData.get("totalDistance") || 0),
    selected: existing?.selected ?? dogs.length === 0
  };
  if (!nextDog.name || !nextDog.breed || !nextDog.birthday) return;
  dogs = existing
    ? dogs.map((dog) => dog.id === id ? nextDog : dog)
    : [...dogs, nextDog];
  if (!dogs.some((dog) => dog.selected) && dogs.length) dogs[0].selected = true;
  saveDogs();
  closeModal();
  renderDogs();
  showToast(`${nextDog.name} saved`);
}

function deleteDog(id) {
  const removed = dogs.find((dog) => dog.id === id);
  dogs = dogs.filter((dog) => dog.id !== id);
  if (removed?.selected && dogs.length) dogs[0].selected = true;
  saveDogs();
  closeModal();
  renderDogs();
  showToast("Dog deleted");
}

function selectDog(id) {
  dogs = dogs.map((dog) => ({ ...dog, selected: dog.id === id }));
  saveDogs();
  renderDogs();
  showToast("Dog selected");
}

function loadDogs() {
  try {
    const raw = localStorage.getItem(DOG_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveDogs() {
  localStorage.setItem(DOG_STORAGE_KEY, JSON.stringify(dogs));
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function createId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `dog-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function dogAge(birthday) {
  if (!birthday) return "Age unknown";
  const birthDate = new Date(`${birthday}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) return "Age unknown";
  const today = new Date();
  let years = today.getFullYear() - birthDate.getFullYear();
  const monthDelta = today.getMonth() - birthDate.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) years -= 1;
  if (years <= 0) return "Under 1 year";
  return `${years} year${years === 1 ? "" : "s"}`;
}

function formatBirthday(birthday) {
  if (!birthday) return "No birthday";
  const date = new Date(`${birthday}T00:00:00`);
  if (Number.isNaN(date.getTime())) return birthday;
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
}

function formatDogDistance(distance) {
  const safeDistance = Number(distance || 0);
  return `${safeDistance.toLocaleString(undefined, { maximumFractionDigits: 1 })} km`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}
