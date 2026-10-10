
import { firebaseConfig, FIREBASE_ENABLED } from "./firebase-config.js";

import { initializeApp } from
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";

import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut, updateProfile
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

import {
  getFirestore, collection, addDoc, getDocs, doc, getDoc,
  setDoc, updateDoc, query, orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const state = {
  user: null,
  role: "student",
  page: "dashboard",
  requests: [],
  announcements: [],
  events: [],
  resources: [],
  attendance: [],
  profile: {},
  localMode: !FIREBASE_ENABLED,
  authMode: "login",
  auth: null,
  db: null
};

const starterResources = [
  {
    title: "Academic Calendar",
    category: "Academics",
    description: "Semester dates, examinations and holidays.",
    url: "https://example.com",
    icon: "▦"
  },
  {
    title: "Library Portal",
    category: "Learning",
    description: "Study materials and library services.",
    url: "https://example.com",
    icon: "▤"
  },
  {
    title: "Student Handbook",
    category: "Student Life",
    description: "Campus guidelines and student policies.",
    url: "https://example.com",
    icon: "▣"
  },
  {
    title: "IT Help Desk",
    category: "Support",
    description: "Help with campus Wi-Fi and technology.",
    url: "https://example.com",
    icon: "⌘"
  },
  {
    title: "Scholarships",
    category: "Finance",
    description: "Find scholarship and financial-aid information.",
    url: "https://example.com",
    icon: "☆"
  },
  {
    title: "Career Services",
    category: "Careers",
    description: "Internships, placements and career guidance.",
    url: "https://example.com",
    icon: "↗"
  }
];

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function toast(message) {
  const element = $("#toast");
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove("show"), 3500);
}

function uid() {
  return state.user?.uid || "demo-student";
}

function localKey(key) {
  return `unihub_${uid()}_${key}`;
}

function readLocal(key, fallback = []) {
  try {
    return JSON.parse(localStorage.getItem(localKey(key)) || "null")
      ?? fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key, data) {
  localStorage.setItem(localKey(key), JSON.stringify(data));
}

function seedDemo() {
  if (!localStorage.getItem(localKey("announcements"))) {
    writeLocal("announcements", [{
      id: "welcome",
      title: "Welcome to UniHub Campus Connect",
      body: "Submit campus requests, follow updates and explore student resources.",
      category: "General",
      createdAt: new Date().toISOString()
    }]);
  }

  if (!localStorage.getItem(localKey("requests"))) {
    writeLocal("requests", []);
  }

  if (!localStorage.getItem(localKey("events"))) {
    writeLocal("events", []);
  }
}

function showAuth() {
  $("#authScreen").classList.remove("hidden");
  $("#appShell").classList.add("hidden");
}

function showApp() {
  $("#authScreen").classList.add("hidden");
  $("#appShell").classList.remove("hidden");
}

function setAuthMode(mode) {
  state.authMode = mode;
  const signup = mode === "signup";

  $("#authTitle").textContent = signup
    ? "Create your UniHub account" : "Welcome back";

  $("#authSubtitle").textContent = signup
    ? "Join your campus workspace."
    : "Sign in to your campus workspace.";

  $("#nameWrap").classList.toggle("hidden", !signup);
  $("#authName").required = signup;
  $("#authSubmit").textContent = signup ? "Create account" : "Sign in";
  $("#switchText").textContent = signup
    ? "Already have an account?" : "New to UniHub?";
  $("#switchAuth").textContent = signup ? "Sign in" : "Create account";
  $("#authPassword").autocomplete = signup ? "new-password" : "current-password";
}

async function initFirebase() {
  if (!FIREBASE_ENABLED) {
    seedDemo();
    return;
  }

  try {
    const app = initializeApp(firebaseConfig);
    state.auth = getAuth(app);
    state.db = getFirestore(app);
    state.localMode = false;
    $("#connectionText").textContent = "Firebase configured";

    onAuthStateChanged(state.auth, async user => {
      if (!user) {
        state.user = null;
        showAuth();
        return;
      }

      try {
        state.user = user;
        await loadProfile();
        await refreshData();
        showApp();
        render();
      } catch (error) {
        console.error(error);
        toast("Could not load your account. Check Firestore rules.");
      }
    });
  } catch (error) {
    console.error(error);
    toast("Firebase could not start. Check firebase-config.js.");
  }
}

async function loadProfile() {
  const userRef = doc(state.db, "users", state.user.uid);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    state.profile = {
      displayName: state.user.displayName || "Student",
      role: "student"
    };

    await setDoc(userRef, {
      displayName: state.profile.displayName,
      email: state.user.email,
      role: "student",
      createdAt: serverTimestamp()
    });
  } else {
    state.profile = snapshot.data();
  }

  state.role = state.profile.role === "admin" ? "admin" : "student";
}

async function loadCollection(name, localName) {
  if (state.localMode) return readLocal(localName, []);

  const snapshot = await getDocs(
    query(collection(state.db, name), orderBy("createdAt", "desc"), limit(100))
  );

  return snapshot.docs.map(item => ({
    id: item.id,
    ...item.data()
  }));
}

async function refreshData() {
  state.requests = await loadCollection("requests", "requests");

  if (!state.localMode && state.role !== "admin") {
    state.requests = state.requests.filter(item => item.uid === uid());
  }

  state.announcements = await loadCollection("announcements", "announcements");
  state.events = await loadCollection("events", "events");
  state.resources = await loadCollection("resources", "resources");
  state.attendance = await loadCollection("attendance", "attendance");

  if (!state.resources.length) {
    state.resources = starterResources;
  }
}

async function addRecord(collectionName, localName, data) {
  if (state.localMode) {
    const items = readLocal(localName, []);
    items.unshift({
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    });
    writeLocal(localName, items);
    return;
  }

  await addDoc(collection(state.db, collectionName), {
    ...data,
    createdAt: serverTimestamp()
  });
}

async function updateRequest(id, status) {
  if (state.localMode) {
    writeLocal("requests", readLocal("requests", []).map(item =>
      item.id === id ? { ...item, status } : item
    ));
  } else {
    await updateDoc(doc(state.db, "requests", id), { status });
  }
}

function formatDate(value) {
  if (!value) return "Just now";
  const date = value.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? "Recently" : date.toLocaleDateString();
}

function statusTag(status = "Pending") {
  let type = "";
  if (/resolved|approved|present/i.test(status)) type = "good";
  else if (/pending|review/i.test(status)) type = "warn";
  else if (/rejected|absent/i.test(status)) type = "bad";

  return `<span class="tag ${type}">${escapeHTML(status)}</span>`;
}

function emptyState(title, description) {
  return `<div class="empty-state">
    <strong>${escapeHTML(title)}</strong>${escapeHTML(description)}
  </div>`;
}

function requestCounts() {
  return {
    total: state.requests.length,
    pending: state.requests.filter(item =>
      !["Resolved", "Rejected"].includes(item.status)
    ).length,
    resolved: state.requests.filter(item => item.status === "Resolved").length
  };
}

function attendancePercent() {
  if (!state.attendance.length) return 85; // Demo display only.
  const present = state.attendance.filter(item => item.status === "Present").length;
  return Math.round(present / state.attendance.length * 100);
}

function dashboardPage() {
  const counts = requestCounts();

  return `
    <section class="hero">
      <div>
        <div class="eyebrow">YOUR CAMPUS, CONNECTED</div>
        <h1>Good ${
          new Date().getHours() < 12 ? "morning" :
          new Date().getHours() < 17 ? "afternoon" : "evening"
        }, ${escapeHTML(state.profile.displayName || "Student")} 👋</h1>
        <p>Keep track of your campus life, requests, and attendance.</p>
        <button class="primary-btn" data-action="new-request">＋ Submit a request</button>
      </div>
      <div class="hero-art">✦ One campus. Endless possibilities.<br>✦ ✧</div>
    </section>

    <div class="stats-grid">
      <div class="stat-card"><div class="stat-title">Total requests</div>
        <div class="stat-icon">▤</div><div class="stat-value">${counts.total}</div>
        <div class="stat-sub">Requests you've submitted</div></div>
      <div class="stat-card"><div class="stat-title">Pending requests</div>
        <div class="stat-icon">◷</div><div class="stat-value">${counts.pending}</div>
        <div class="stat-sub">Awaiting an update</div></div>
      <div class="stat-card"><div class="stat-title">Attendance</div>
        <div class="stat-icon">▦</div><div class="stat-value">${attendancePercent()}%</div>
        <div class="stat-sub">Overall attendance</div></div>
      <div class="stat-card"><div class="stat-title">Resolved</div>
        <div class="stat-icon">✓</div><div class="stat-value">${counts.resolved}</div>
        <div class="stat-sub">Completed requests</div></div>
    </div>

    <div class="grid-2">
      <section class="panel">
        <div class="section-row"><h2>Recent requests</h2>
          <button class="secondary-btn" data-page="requests">View all</button></div>
        ${state.requests.slice(0, 3).map(item => `
          <div class="activity-item"><div><b>${escapeHTML(item.title)}</b>
            <div class="muted tiny">${escapeHTML(item.category)} · ${formatDate(item.createdAt)}</div>
          </div>${statusTag(item.status)}</div>
        `).join("") || emptyState("No requests yet", "Submit a campus request and track it here.")}
      </section>

      <section class="panel">
        <div class="section-row"><h2>Campus announcements</h2>
          <button class="secondary-btn" data-page="announcements">View all</button></div>
        ${state.announcements.slice(0, 3).map(item => `
          <div class="announcement-item"><div><b>${escapeHTML(item.title)}</b>
            <p class="muted">${escapeHTML(item.body)}</p>
            <small class="muted">${formatDate(item.createdAt)}</small>
          </div></div>
        `).join("") || emptyState("No announcements", "Campus updates will appear here.")}
      </section>
    </div>`;
}

function requestsPage() {
  return `
    <div class="section-row"><div><h1 class="page-title">My Requests</h1>
      <p class="page-description">Track campus service requests and status updates.</p></div>
      <button class="primary-btn" data-action="new-request">＋ New request</button>
    </div>
    <div class="content-card">
      <div class="search-row">
        <input id="requestSearch" placeholder="Search requests...">
        <select id="requestStatus">
          <option value="">All statuses</option><option>Pending</option>
          <option>In Review</option><option>Resolved</option><option>Rejected</option>
        </select>
      </div>
      <div id="requestTable"></div>
    </div>`;
}

function renderRequestTable() {
  const target = $("#requestTable");
  if (!target) return;

  const term = ($("#requestSearch")?.value || "").toLowerCase();
  const status = $("#requestStatus")?.value || "";

  const items = state.requests.filter(item =>
    `${item.title} ${item.description} ${item.category}`.toLowerCase().includes(term)
    && (!status || item.status === status)
  );

  if (!items.length) {
    target.innerHTML = emptyState("No matching requests", "Try another search or create a request.");
    return;
  }

  target.innerHTML = `<div class="table-wrap"><table class="data-table">
    <thead><tr><th>Request</th><th>Category</th><th>Submitted</th><th>Status</th>
    ${state.role === "admin" ? "<th>Update status</th>" : ""}</tr></thead>
    <tbody>${items.map(item => `<tr>
      <td><b>${escapeHTML(item.title)}</b><div class="muted tiny">${escapeHTML(item.description)}</div></td>
      <td>${escapeHTML(item.category)}</td><td>${formatDate(item.createdAt)}</td>
      <td>${statusTag(item.status)}</td>
      ${state.role === "admin" ? `<td><select data-status-id="${escapeHTML(item.id)}">
        ${["Pending", "In Review", "Resolved", "Rejected"].map(status =>
          `<option ${item.status === status ? "selected" : ""}>${status}</option>`
        ).join("")}</select></td>` : ""}
    </tr>`).join("")}</tbody></table></div>`;
}

function submitPage(category = "General") {
  return `
    <div class="section-row"><div><h1 class="page-title">Submit a Request</h1>
      <p class="page-description">Tell the campus team what you need help with.</p></div></div>
    <form id="requestForm" class="content-card">
      <div class="form-grid">
        <div class="field"><label for="reqTitle">Request title *</label>
          <input id="reqTitle" required maxlength="100" placeholder="e.g. Projector not working"></div>
        <div class="field"><label for="reqCategory">Category *</label>
          <select id="reqCategory">
            ${["General", "Classroom Issue", "Lost & Found", "Event Idea", "IT Support", "Facilities", "Attendance"]
              .map(value => `<option ${value === category ? "selected" : ""}>${value}</option>`).join("")}
          </select></div>
      </div>
      <div class="field"><label for="reqDescription">Description *</label>
        <textarea id="reqDescription" required maxlength="2000" placeholder="Share the details..."></textarea></div>
      <div class="form-grid">
        <div class="field"><label for="reqLocation">Location (optional)</label>
          <input id="reqLocation" placeholder="Building / classroom"></div>
        <div class="field"><label for="reqPriority">Priority</label>
          <select id="reqPriority"><option>Normal</option><option>High</option><option>Low</option></select></div>
      </div>
      <div class="form-actions"><button class="primary-btn">Submit request →</button>
        <button type="reset" class="secondary-btn">Clear form</button></div>
    </form>`;
}

function attendancePage() {
  const percent = attendancePercent();
  return `
    <div class="section-row"><div><h1 class="page-title">Attendance</h1>
      <p class="page-description">Your attendance overview.</p></div></div>
    <div class="grid-2">
      <section class="content-card"><div class="muted">Overall attendance</div>
        <div class="attendance-number">${percent}%</div>
        <div class="progress"><span style="width:${percent}%"></span></div>
        <p class="muted">${state.attendance.length
          ? `${state.attendance.filter(item => item.status === "Present").length} present records out of ${state.attendance.length}.`
          : "No real attendance records loaded. 85% is a demo placeholder."}</p>
      </section>
      <section class="content-card"><h3>Attendance guidance</h3>
        <p class="muted">Contact your faculty if a record appears incorrect.</p>
        <button class="secondary-btn" data-action="attendance-help">Request attendance correction</button>
      </section>
    </div>
    <div class="content-card"><h3>Recent records</h3>
      ${state.attendance.length ? state.attendance.map(item => `
        <div class="activity-item"><span>${escapeHTML(item.subject || "Class")} · ${formatDate(item.date || item.createdAt)}</span>
        ${statusTag(item.status || "Unknown")}</div>`).join("")
        : emptyState("No records yet", "Attendance data must be added by your institution.")}</div>`;
}

function announcementsPage() {
  return `
    <div class="section-row"><div><h1 class="page-title">Announcements</h1>
      <p class="page-description">The latest updates for your campus.</p></div>
      ${state.role === "admin" ? '<button class="primary-btn" data-action="new-announcement">＋ Publish update</button>' : ""}
    </div>
    <div class="content-card">${state.announcements.map(item => `
      <article class="announcement-item"><div>${statusTag(item.category || "General")}
        <h3>${escapeHTML(item.title)}</h3><p class="muted">${escapeHTML(item.body)}</p>
        <small class="muted">${formatDate(item.createdAt)}</small></div></article>
    `).join("") || emptyState("No announcements", "Campus updates will appear here.")}</div>`;
}

function eventsPage() {
  return `
    <div class="section-row"><div><h1 class="page-title">Event Ideas</h1>
      <p class="page-description">Suggest a workshop, club activity or campus event.</p></div>
      <button class="primary-btn" data-action="new-event">＋ Suggest an event</button></div>
    <div class="content-card">${state.events.map(item => `
      <div class="activity-item"><div><b>${escapeHTML(item.title)}</b>
        <p class="muted">${escapeHTML(item.description)}</p>
        <small class="muted">${escapeHTML(item.proposedDate || "Date not set")}</small></div>
        ${statusTag(item.status || "Pending")}</div>
    `).join("") || emptyState("No event ideas yet", "Be the first to suggest a campus event.")}</div>`;
}

function resourcesPage() {
  return `
    <div class="section-row"><div><h1 class="page-title">Student Resources</h1>
      <p class="page-description">Useful links for learning, campus life and support.</p></div></div>
    <div class="resource-grid">${state.resources.map(item => `
      <article class="resource-tile"><div class="resource-icon">${escapeHTML(item.icon || "▣")}</div>
        ${statusTag(item.category || "Resource")}<h3>${escapeHTML(item.title)}</h3>
        <p>${escapeHTML(item.description || "")}</p>
        <a href="${escapeHTML(item.url || "#")}" target="_blank" rel="noopener noreferrer">Open resource ↗</a>
      </article>`).join("")}</div>
    <p class="muted tiny">Replace example.com with your college's official resource links.</p>`;
}

function adminPage() {
  if (state.role !== "admin") {
    return `<div class="content-card">${emptyState("Admin access required", "Your account is not an administrator.")}</div>`;
  }

  const counts = requestCounts();
  return `
    <div class="section-row"><div><h1 class="page-title">Admin Console</h1>
      <p class="page-description">Review requests and publish campus updates.</p></div></div>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-title">All requests</div><div class="stat-value">${counts.total}</div></div>
      <div class="stat-card"><div class="stat-title">Awaiting action</div><div class="stat-value">${counts.pending}</div></div>
      <div class="stat-card"><div class="stat-title">Resolved</div><div class="stat-value">${counts.resolved}</div></div>
      <div class="stat-card"><div class="stat-title">Announcements</div><div class="stat-value">${state.announcements.length}</div></div>
    </div>
    <div class="content-card"><h3>Request queue</h3><div id="requestTable"></div></div>
    <div class="content-card"><h3>Admin actions</h3>
      <div class="form-actions">
        <button class="primary-btn" data-action="new-announcement">＋ Publish announcement</button>
        <button class="secondary-btn" data-action="new-resource">＋ Add resource</button>
      </div>
      <p class="muted tiny">Admin access must be granted in Firestore by a trusted project owner.</p>
    </div>`;
}

function profilePage() {
  return `
    <div class="section-row"><div><h1 class="page-title">My Profile</h1>
      <p class="page-description">Manage your campus account details.</p></div></div>
    <form id="profileForm" class="content-card">
      <div class="field"><label for="profileDisplayName">Full name</label>
        <input id="profileDisplayName" required maxlength="80" value="${escapeHTML(state.profile.displayName || "")}"></div>
      <div class="field"><label>Email</label><input disabled value="${escapeHTML(state.user?.email || "demo@unihub.local")}"></div>
      <div class="field"><label>Portal role</label><input disabled value="${escapeHTML(state.role)}"></div>
      <button class="primary-btn">Save profile</button>
    </form>`;
}

function adminOnlyNav() {
  $$(".admin-nav").forEach(element =>
    element.classList.toggle("hidden", state.role !== "admin")
  );
}

function render() {
  const titles = {
    dashboard: "Dashboard", requests: "My Requests", attendance: "Attendance",
    submit: "Submit a Request", classroom: "Classroom Issues",
    lostfound: "Lost & Found", events: "Event Ideas",
    announcements: "Announcements", resources: "Student Resources",
    admin: "Admin Console", profile: "My Profile"
  };

  adminOnlyNav();
  $("#roleSelect").value = state.role;
  $("#roleSelect").disabled = !state.localMode;
  $("#profileName").textContent = state.profile.displayName || "Student";
  $("#profileEmail").textContent = state.user?.email || "Demo account";
  $("#avatar").textContent = (state.profile.displayName || "S").charAt(0).toUpperCase();
  $("#todayDate").textContent = new Intl.DateTimeFormat("en-IN", {
    weekday: "short", month: "short", day: "numeric"
  }).format(new Date());
  $("#requestBadge").textContent = state.requests.filter(item => item.status !== "Resolved").length;
  $("#crumbTitle").textContent = titles[state.page] || "Dashboard";

  $$(".nav-item[data-page]").forEach(button =>
    button.classList.toggle("active", button.dataset.page === state.page)
  );

  const pages = {
    dashboard: dashboardPage,
    requests: requestsPage,
    attendance: attendancePage,
    submit: () => submitPage(),
    classroom: () => submitPage("Classroom Issue"),
    lostfound: () => submitPage("Lost & Found"),
    events: eventsPage,
    announcements: announcementsPage,
    resources: resourcesPage,
    admin: adminPage,
    profile: profilePage
  };

  $("#pageContent").innerHTML = (pages[state.page] || dashboardPage)();

  if (state.page === "requests" || state.page === "admin") {
    renderRequestTable();
  }

  if (innerWidth < 800) $("#sidebar").classList.remove("open");
}

function go(page) {
  state.page = page;
  $("#profileMenu").classList.add("hidden");
  render();
}

function openModal(content) {
  $("#modalContent").innerHTML = content;
  $("#modal").showModal();
}

function eventModal() {
  openModal(`
    <h2>Suggest an event</h2>
    <form id="eventForm">
      <div class="field"><label>Event title *</label><input id="eventTitle" required maxlength="100"></div>
      <div class="field"><label>Description *</label><textarea id="eventDescription" required maxlength="1500"></textarea></div>
      <div class="field"><label>Proposed date</label><input id="eventDate" type="date"></div>
      <div class="modal-actions"><button type="button" class="secondary-btn" data-action="close-modal">Cancel</button>
      <button class="primary-btn">Submit idea</button></div>
    </form>`);
}

function announcementModal() {
  openModal(`
    <h2>Publish announcement</h2>
    <form id="announcementForm">
      <div class="field"><label>Title *</label><input id="announcementTitle" required maxlength="120"></div>
      <div class="field"><label>Category</label>
        <select id="announcementCategory"><option>General</option><option>Academic</option><option>Events</option><option>Urgent</option></select>
      </div>
      <div class="field"><label>Message *</label><textarea id="announcementBody" required maxlength="2500"></textarea></div>
      <div class="modal-actions"><button type="button" class="secondary-btn" data-action="close-modal">Cancel</button>
      <button class="primary-btn">Publish</button></div>
    </form>`);
}

function resourceModal() {
  openModal(`
    <h2>Add student resource</h2>
    <form id="resourceForm">
      <div class="field"><label>Title *</label><input id="resourceTitle" required></div>
      <div class="field"><label>Category</label><input id="resourceCategory" value="Campus"></div>
      <div class="field"><label>URL *</label><input id="resourceUrl" type="url" required placeholder="https://..."></div>
      <div class="field"><label>Description</label><textarea id="resourceDescription"></textarea></div>
      <div class="modal-actions"><button type="button" class="secondary-btn" data-action="close-modal">Cancel</button>
      <button class="primary-btn">Save resource</button></div>
    </form>`);
}

document.addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.target;

  try {
    if (form.id === "requestForm") {
      await addRecord("requests", "requests", {
        uid: uid(),
        authorName: state.profile.displayName || "Student",
        title: $("#reqTitle").value.trim(),
        category: $("#reqCategory").value,
        description: $("#reqDescription").value.trim(),
        location: $("#reqLocation").value.trim(),
        priority: $("#reqPriority").value,
        status: "Pending"
      });

      await refreshData();
      go("requests");
      toast("Request submitted successfully.");
    }

    if (form.id === "eventForm") {
      await addRecord("events", "events", {
        uid: uid(),
        authorName: state.profile.displayName || "Student",
        title: $("#eventTitle").value.trim(),
        description: $("#eventDescription").value.trim(),
        proposedDate: $("#eventDate").value,
        status: "Pending"
      });

      $("#modal").close();
      await refreshData();
      go("events");
      toast("Your event idea was submitted.");
    }

    if (form.id === "announcementForm") {
      if (state.role !== "admin") throw new Error("Admin access is required.");

      await addRecord("announcements", "announcements", {
        uid: uid(),
        title: $("#announcementTitle").value.trim(),
        category: $("#announcementCategory").value,
        body: $("#announcementBody").value.trim()
      });

      $("#modal").close();
      await refreshData();
      go("announcements");
      toast("Announcement published.");
    }

    if (form.id === "resourceForm") {
      if (state.role !== "admin") throw new Error("Admin access is required.");

      await addRecord("resources", "resources", {
        uid: uid(),
        title: $("#resourceTitle").value.trim(),
        category: $("#resourceCategory").value.trim(),
        description: $("#resourceDescription").value.trim(),
        url: $("#resourceUrl").value.trim(),
        icon: "▣"
      });

      $("#modal").close();
      await refreshData();
      go("resources");
      toast("Resource added.");
    }

    if (form.id === "profileForm") {
      const name = $("#profileDisplayName").value.trim();
      if (!name) throw new Error("Please enter your name.");

      state.profile.displayName = name;

      if (!state.localMode) {
        await updateProfile(state.user, { displayName: name });
        await setDoc(doc(state.db, "users", state.user.uid), {
          displayName: name,
          email: state.user.email,
          role: state.role,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }

      render();
      toast("Profile saved.");
    }
  } catch (error) {
    console.error(error);
    toast(error.message || "Something went wrong.");
  }
});

document.addEventListener("click", async event => {
  const pageButton = event.target.closest("[data-page]");
  if (pageButton) {
    go(pageButton.dataset.page);
    return;
  }

  const action = event.target.closest("[data-action]")?.dataset.action;

  if (action === "new-request") go("submit");
  if (action === "new-event") eventModal();
  if (action === "new-announcement") {
    if (state.role !== "admin") return toast("Admin access is required.");
    announcementModal();
  }
  if (action === "new-resource") {
    if (state.role !== "admin") return toast("Admin access is required.");
    resourceModal();
  }
  if (action === "close-modal") $("#modal").close();

  if (action === "attendance-help") {
    go("submit");
    $("#reqTitle").value = "Attendance correction request";
    $("#reqCategory").value = "Attendance";
  }

  const profileAction = event.target.closest("[data-profile]")?.dataset.profile;
  if (profileAction === "profile") go("profile");

  if (profileAction === "signout") {
    if (state.localMode) {
      state.user = null;
      state.profile = {};
      showAuth();
      setAuthMode("login");
    } else {
      await signOut(state.auth);
    }
  }

  if (event.target.closest("#profileBtn")) {
    $("#profileMenu").classList.toggle("hidden");
  } else if (!event.target.closest("#profileMenu")) {
    $("#profileMenu").classList.add("hidden");
  }
});

document.addEventListener("input", event => {
  if (event.target.id === "requestSearch") renderRequestTable();
});

document.addEventListener("change", async event => {
  if (event.target.id === "requestStatus") renderRequestTable();

  if (event.target.id === "roleSelect") {
    if (!state.localMode) {
      toast("Firebase roles are controlled by account permissions.");
      render();
      return;
    }
    state.role = event.target.value;
    state.profile.role = state.role;
    render();
  }

  if (event.target.dataset.statusId) {
    if (state.role !== "admin") return toast("Admin access is required.");

    try {
      await updateRequest(event.target.dataset.statusId, event.target.value);
      await refreshData();
      render();
      toast("Request status updated.");
    } catch (error) {
      console.error(error);
      toast("Could not update status. Check your admin permissions.");
    }
  }
});

$("#switchAuth").addEventListener("click", () =>
  setAuthMode(state.authMode === "login" ? "signup" : "login")
);

$("#authForm").addEventListener("submit", async event => {
  event.preventDefault();

  const email = $("#authEmail").value.trim();
  const password = $("#authPassword").value;
  const name = $("#authName").value.trim();

  try {
    if (state.localMode) {
      state.user = {
        uid: "demo-" + email.toLowerCase(),
        email,
        displayName: name || email.split("@")[0]
      };
      state.profile = {
        displayName: state.user.displayName,
        role: "student"
      };
      state.role = "student";
      seedDemo();
      await refreshData();
      showApp();
      render();
      toast("Signed in using local demo mode. Data stays in this browser.");
      return;
    }

    if (state.authMode === "signup") {
      const credential = await createUserWithEmailAndPassword(
        state.auth, email, password
      );

      await updateProfile(credential.user, { displayName: name });

      await setDoc(doc(state.db, "users", credential.user.uid), {
        displayName: name,
        email,
        role: "student",
        createdAt: serverTimestamp()
      });

      toast("Account created. Welcome to UniHub!");
    } else {
      await signInWithEmailAndPassword(state.auth, email, password);
      toast("Welcome back!");
    }
  } catch (error) {
    console.error(error);

    const messages = {
      "auth/email-already-in-use": "This email already has an account. Sign in instead.",
      "auth/invalid-credential": "Email or password is incorrect.",
      "auth/weak-password": "Choose a stronger password.",
      "auth/invalid-email": "Enter a valid email address."
    };

    toast(messages[error.code] || error.message || "Authentication failed.");
  }
});

$("#menuToggle").addEventListener("click", () =>
  $("#sidebar").classList.toggle("open")
);

$("#notifyBtn").addEventListener("click", () => go("announcements"));

setAuthMode("login");

if (FIREBASE_ENABLED) {
  showAuth();
  initFirebase();
} else {
  seedDemo();
  state.user = {
    uid: "demo-student",
    email: "student@unihub.local",
    displayName: "Student"
  };
  state.profile = { displayName: "Student", role: "student" };
  showApp();
  refreshData().then(render);
  $("#connectionText").textContent = "Local demo mode";
}
