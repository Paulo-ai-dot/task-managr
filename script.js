// script.js
const STORAGE_KEY = "task_manager_tasks_v2";
const THEME_KEY = "task_manager_theme_v2";

let tasks = [];
let searchTerm = "";
let currentCategory = "All";
let currentSort = "name";
let currentPage = "dashboard";

/* Elements */
const yearEl = document.getElementById("year");
const footerYearEl = document.getElementById("footerYear");
const navButtons = document.querySelectorAll(".nav-btn");
const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const sortSelect = document.getElementById("sortSelect");
const addTaskBtn = document.getElementById("addTaskBtn");

const totalCountEl = document.getElementById("totalCount");
const completedCountEl = document.getElementById("completedCount");
const pendingCountEl = document.getElementById("pendingCount");
const tasksContainer = document.getElementById("tasksContainer");

const taskModal = document.getElementById("taskModal");
const taskForm = document.getElementById("taskForm");

const dashboardPage = document.getElementById("dashboardPage");
const statsPage = document.getElementById("statsPage");
const settingsPage = document.getElementById("settingsPage");

const toastContainer = document.getElementById("toastContainer");

/* Stats elements */
const statTotalEl = document.getElementById("statTotal");
const statCompletedEl = document.getElementById("statCompleted");
const statPendingEl = document.getElementById("statPending");
const statOverdueEl = document.getElementById("statOverdue");
const statCompletionPctEl = document.getElementById("statCompletionPct");
const statCompletionBarEl = document.getElementById("statCompletionBar");
const statPerCategoryEl = document.getElementById("statPerCategory");

/* Theme toggles */
const themeToggleSwitch = document.getElementById("themeToggleSwitch");
const settingsThemeSwitch = document.getElementById("settingsThemeSwitch");

/* Utils */
const nowISODate = () => new Date().toISOString().slice(0, 10);
const isOverdue = (dueDate, completed) => {
  if (!dueDate) return false;
  const today = new Date(nowISODate());
  const d = new Date(dueDate);
  return d < today && !completed;
};
const safeText = (str) => String(str ?? "").trim();

document.addEventListener("DOMContentLoaded", () => {
  const y = new Date().getFullYear();
  if (yearEl) yearEl.textContent = y;
  if (footerYearEl) footerYearEl.textContent = y;

  loadFromLocal();
  applySavedTheme();

  renderPage();
  attachEvents();
});

/* Events */
function attachEvents() {
  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      navButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentPage = btn.dataset.page || "dashboard";
      renderPage();
    });
  });

  searchInput.addEventListener("input", (e) => {
    searchTerm = e.target.value.toLowerCase();
    searchTasks();
  });

  categoryFilter.addEventListener("change", (e) => {
    currentCategory = e.target.value;
    filterTasks();
  });

  sortSelect.addEventListener("change", (e) => {
    currentSort = e.target.value;
    sortTasks();
  });

  addTaskBtn.addEventListener("click", openModal);
  document.querySelectorAll("[data-close='modal']").forEach((el) =>
    el.addEventListener("click", closeModal)
  );

  taskForm.addEventListener("submit", (e) => {
    e.preventDefault();
    addTask();
  });

  // Theme toggles
  if (themeToggleSwitch) {
    themeToggleSwitch.addEventListener("change", () => {
      const next = themeToggleSwitch.checked ? "dark" : "light";
      setTheme(next, true);
    });
  }
  if (settingsThemeSwitch) {
    settingsThemeSwitch.addEventListener("change", () => {
      const next = settingsThemeSwitch.checked ? "dark" : "light";
      setTheme(next, true);
    });
  }

  // Reset
  const resetBtn = document.getElementById("resetBtn");
  resetBtn.addEventListener("click", resetAllTasks);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
}

/* Modal */
function openModal() {
  taskModal.classList.add("show");
  taskModal.setAttribute("aria-hidden", "false");
  taskForm.reset();
  document.getElementById("taskName").focus();
}
function closeModal() {
  taskModal.classList.remove("show");
  taskModal.setAttribute("aria-hidden", "true");
}

/* Core */
function addTask() {
  const name = safeText(document.getElementById("taskName").value);
  const dueDate = safeText(document.getElementById("taskDueDate").value);
  const category = safeText(document.getElementById("taskCategory").value);
  const priority = safeText(document.getElementById("taskPriority").value);

  if (!name) {
    showToast("❗ Enter a task name", "warn");
    return;
  }

  const newTask = {
    id: cryptoRandomId(),
    name,
    dueDate: dueDate || "",
    category: category || "",
    priority: priority || "",
    completed: false,
    createdAt: new Date().toISOString()
  };

  tasks.push(newTask);
  saveToLocal();
  closeModal();
  renderTasks();
  updateCounters();
  updateStats();
  showToast("✅ Task added", "success");
}

function deleteTask(id) {
  tasks = tasks.filter((t) => t.id !== id);
  saveToLocal();
  renderTasks();
  updateCounters();
  updateStats();
  showToast("🗑️ Task removed", "info");
}

function toggleComplete(id) {
  const t = tasks.find((x) => x.id === id);
  if (!t) return;
  t.completed = !t.completed;
  saveToLocal();
  renderTasks();
  updateCounters();
  updateStats();
  showToast(t.completed ? "🎉 Task completed" : "↩️ Marked as pending", "success");
}

/* Rendering */
function renderTasks() {
  const filtered = getFilteredTasks();
  const sorted = getSortedTasks(filtered);

  tasksContainer.innerHTML = "";
  if (!sorted.length) {
    tasksContainer.innerHTML = `<div class="empty"><p class="muted">No tasks to show.</p></div>`;
    return;
  }

  sorted.forEach((t) => {
    const card = document.createElement("div");
    card.className = "task-card";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "task-check";
    checkbox.checked = t.completed;
    checkbox.title = "Mark complete";
    checkbox.addEventListener("change", () => toggleComplete(t.id));

    const title = document.createElement("h4");
    title.className = "task-title" + (t.completed ? " completed" : "");
    title.textContent = t.name;

    const actions = document.createElement("div");
    actions.className = "task-actions";
    const delBtn = document.createElement("button");
    delBtn.className = "delete-btn";
    delBtn.title = "Delete task";
    delBtn.innerHTML = `<i class="fa-solid fa-trash"></i>`;
    delBtn.addEventListener("click", () => deleteTask(t.id));
    actions.appendChild(delBtn);

    const badges = document.createElement("div");
    badges.className = "badges";

    // Category badge with icon
    if (t.category) {
      const catIcon = categoryIcon(t.category);
      const cat = document.createElement("span");
      cat.className = `badge cat-${t.category}`;
      cat.innerHTML = `${catIcon}<span>${t.category}</span>`;
      badges.appendChild(cat);
    }

    // Priority badge
    if (t.priority) {
      const pr = document.createElement("span");
      const pClass =
        t.priority === "High" ? "priority-high" :
        t.priority === "Medium" ? "priority-medium" : "priority-low";
      pr.className = `badge ${pClass}`;
      pr.innerHTML = `<i class="fa-solid fa-star"></i><span>${t.priority}</span>`;
      badges.appendChild(pr);
    }

    // Due date + overdue
    if (t.dueDate) {
      const due = document.createElement("span");
      due.className = "badge due";
      due.innerHTML = `<i class="fa-solid fa-calendar-day"></i><span>${t.dueDate}</span>`;
      badges.appendChild(due);

      if (isOverdue(t.dueDate, t.completed)) {
        const od = document.createElement("span");
        od.className = "badge overdue";
        od.innerHTML = `<i class="fa-solid fa-clock"></i><span>Overdue</span>`;
        badges.appendChild(od);
      }
    }

    card.appendChild(checkbox);
    card.appendChild(title);
    card.appendChild(actions);
    card.appendChild(badges);

    tasksContainer.appendChild(card);
  });
}

/* Filters / search / sort */
function filterTasks() {
  renderTasks();
  updateCounters();
}
function searchTasks() {
  renderTasks();
  updateCounters();
}
function sortTasks() {
  renderTasks();
  updateCounters();
}

function getFilteredTasks() {
  return tasks.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(searchTerm);
    const matchesCategory = currentCategory === "All" || t.category === currentCategory;
    return matchesSearch && matchesCategory;
  });
}
function getSortedTasks(list) {
  const arr = [...list];
  switch (currentSort) {
    case "name":
      arr.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "dueDate":
      arr.sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
      break;
    case "category":
      arr.sort((a, b) => (a.category || "").localeCompare(b.category || ""));
      break;
    case "priority":
      const order = { High: 3, Medium: 2, Low: 1, "": 0 };
      arr.sort((a, b) => order[b.priority || ""] - order[a.priority || ""]);
      break;
  }
  return arr;
}

/* Counters */
function updateCounters() {
  const filtered = getFilteredTasks();
  const total = filtered.length;
  const completed = filtered.filter((t) => t.completed).length;
  const pending = total - completed;

  totalCountEl.textContent = total;
  completedCountEl.textContent = completed;
  pendingCountEl.textContent = pending;
}

/* Local storage */
function saveToLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}
function loadFromLocal() {
  const raw = localStorage.getItem(STORAGE_KEY);
  tasks = raw ? JSON.parse(raw) : seedDemoTasks();
}

/* Theme */
function setTheme(mode, announce = false) {
  document.documentElement.setAttribute("data-theme", mode);
  localStorage.setItem(THEME_KEY, mode);
  const isDark = mode === "dark";
  if (themeToggleSwitch) themeToggleSwitch.checked = isDark;
  if (settingsThemeSwitch) settingsThemeSwitch.checked = isDark;
  if (announce) showToast(isDark ? "🌙 Dark mode on" : "🔆 Light mode on", "info");
}
function applySavedTheme() {
  const saved = localStorage.getItem(THEME_KEY) || "light";
  setTheme(saved, false);
}

/* Reset */
function resetAllTasks() {
  const confirmed = confirm("Reset all tasks? This cannot be undone.");
  if (!confirmed) return;
  tasks = [];
  saveToLocal();
  renderTasks();
  updateCounters();
  updateStats();
  showToast("♻️ All tasks reset", "warn");
}

/* Stats */
function updateStats() {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.completed).length;
  const pending = total - completed;
  const overdue = tasks.filter((t) => isOverdue(t.dueDate, t.completed)).length;
  const pct = total ? Math.round((completed / total) * 100) : 0;

  statTotalEl.textContent = total;
  statCompletedEl.textContent = completed;
  statPendingEl.textContent = pending;
  statOverdueEl.textContent = overdue;
  statCompletionPctEl.textContent = `${pct}%`;
  statCompletionBarEl.style.width = `${pct}%`;

  const byCategory = { Work: 0, School: 0, Personal: 0, Home: 0, Other: 0, None: 0 };
  tasks.forEach((t) => { byCategory[t.category || "None"] = (byCategory[t.category || "None"] || 0) + 1; });

  statPerCategoryEl.innerHTML = "";
  Object.entries(byCategory).forEach(([cat, count]) => {
    const li = document.createElement("li");
    li.innerHTML = `${categoryIcon(cat)} ${cat}: ${count}`;
    statPerCategoryEl.appendChild(li);
  });
}

/* Page rendering */
function renderPage() {
  dashboardPage.classList.toggle("active", currentPage === "dashboard");
  statsPage.classList.toggle("active", currentPage === "stats");
  settingsPage.classList.toggle("active", currentPage === "settings");

  renderTasks();
  updateCounters();
  updateStats();
}

/* Toasts */
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = "toast";
  const icon = document.createElement("span");
  icon.className = "icon";
  icon.innerHTML = type === "success" ? "✅" : type === "warn" ? "⚠️" : "ℹ️";
  const text = document.createElement("span");
  text.textContent = message;

  toast.appendChild(icon);
  toast.appendChild(text);
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(6px)";
    toast.style.transition = "opacity 160ms ease, transform 160ms ease";
    setTimeout(() => toast.remove(), 160);
  }, 2200);
}

/* Category icons */
function categoryIcon(cat) {
  const map = {
    Work: '<i class="fa-solid fa-briefcase"></i>',
    School: '<i class="fa-solid fa-graduation-cap"></i>',
    Personal: '<i class="fa-solid fa-user"></i>',
    Home: '<i class="fa-solid fa-house"></i>',
    Other: '<i class="fa-solid fa-folder"></i>',
    None: '<i class="fa-regular fa-circle"></i>'
  };
  return map[cat] || '<i class="fa-solid fa-folder"></i>';
}

/* IDs */
function cryptoRandomId() {
  if (window.crypto && window.crypto.getRandomValues) {
    const buf = new Uint32Array(4);
    window.crypto.getRandomValues(buf);
    return Array.from(buf).map((n) => n.toString(16)).join("");
  }
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

/* Demo data */
function seedDemoTasks() {
  const demo = [
    {
      id: cryptoRandomId(),
      name: "Finish math assignment",
      dueDate: addDaysISO(1),
      category: "School",
      priority: "High",
      completed: false,
      createdAt: new Date().toISOString()
    },
    {
      id: cryptoRandomId(),
      name: "Team stand-up",
      dueDate: addDaysISO(0),
      category: "Work",
      priority: "Medium",
      completed: false,
      createdAt: new Date().toISOString()
    },
    {
      id: cryptoRandomId(),
      name: "Buy groceries",
      dueDate: addDaysISO(2),
      category: "Home",
      priority: "Low",
      completed: false,
      createdAt: new Date().toISOString()
    },
    {
      id: cryptoRandomId(),
      name: "Gym session",
      dueDate: addDaysISO(3),
      category: "Personal",
      priority: "Medium",
      completed: false,
      createdAt: new Date().toISOString()
    },
    {
      id: cryptoRandomId(),
      name: "Misc reminders",
      dueDate: "",
      category: "Other",
      priority: "",
      completed: false,
      createdAt: new Date().toISOString()
    }
  ];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(demo));
  return demo;
}
function addDaysISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
