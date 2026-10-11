
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const USER_KEY = "unihubUser";
  const DATA_KEY = "unihubRequests";
  const ATT_KEY = "unihubAttendance";
  const FILE_LIMIT = 900 * 1024;

  let page = "dashboard";
  let history = [];
  let toastTimer;

  const navConfig = {
    student: [
      { group: "OVERVIEW", items: [
        ["dashboard", "⌂", "Dashboard"],
        ["requests", "▤", "My Requests"],
        ["attendance", "▦", "Attendance"]
      ]},
      { group: "CAMPUS SERVICES", items: [
        ["submit", "＋", "Submit a Request"],
        ["classroom", "□", "Classroom Issues"],
        ["lostfound", "⌕", "Lost & Found"],
        ["events", "✳", "Events & Ideas"],
        ["notices", "▧", "Notices & Brochures"],
        ["profile", "♙", "My Profile"]
      ]}
    ],
    faculty: [
      { group: "FACULTY WORKSPACE", items: [
        ["dashboard", "⌂", "Dashboard"],
        ["faculty-requests", "▤", "Review Requests"],
        ["attendance", "▦", "Attendance"],
        ["classroom", "□", "Classroom Issues"],
        ["students", "♙", "Student Profiles"],
        ["events", "✳", "Event Proposals"],
        ["lostfound", "⌕", "Lost & Found"],
        ["profile", "♙", "My Profile"]
      ]}
    ],
    office: [
      { group: "OFFICE WORKSPACE", items: [
        ["dashboard", "⌂", "Dashboard"],
        ["office-requests", "▤", "Bonafide Requests"],
        ["certificates", "▧", "Bonafide Certificates"],
        ["lostfound", "⌕", "Lost & Found Management"],
        ["reports", "▦", "Request Reports"],
        ["profile", "♙", "My Profile"]
      ]}
    ]
  };

  const titles = {
    dashboard: "Dashboard",
    requests: "My Requests",
    attendance: "Attendance",
    submit: "Submit a Request",
    classroom: "Classroom Issues",
    lostfound: "Lost & Found",
    events: "Events & Ideas",
    notices: "Notices & Brochures",
    profile: "My Profile",
    "faculty-requests": "Review Requests",
    students: "Student Profiles",
    "office-requests": "Bonafide Requests",
    certificates: "Bonafide Certificates",
    reports: "Request Reports",
    "classroom-form": "Report a Classroom Issue",
    "events-form": "Submit an Event Idea",
    "lostfound-form": "Add Lost & Found Listing"
  };

  const $page = () => $("pageContent");

  function getUser() {
    try {
      return JSON.parse(sessionStorage.getItem(USER_KEY) || "null");
    } catch {
      return null;
    }
  }

  function role() {
    return getUser()?.role || "student";
  }

  function getData(key, fallback = []) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
    } catch {
      return fallback;
    }
  }

  function saveData(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function allRequests() {
    return getData(DATA_KEY, []);
  }

  function uid() {
    return crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function toast(text) {
    const element = $("toast");
    element.textContent = text;
    element.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(
      () => element.classList.add("hidden"),
      3200
    );
  }

  function isBonafide(item) {
    return item.type === "Bonafide Certificate";
  }

  function isUploadOnly(item) {
    return ["On-Duty (OD)", "Leave Permission"].includes(item.type);
  }

  function isFacultyItem(item) {
    return ["Classroom Issue", "Event Idea", "Other"].includes(item.type);
  }

  function canFacultyReview(item) {
    return isFacultyItem(item) &&
      ["Submitted", "Under Review"].includes(item.status);
  }

  function isLostFound(item) {
    return ["Lost item", "Found item", "Lost & Found"].includes(item.type);
  }

  function statusBadge(status) {
    let cssClass = "";

    if ([
      "Uploaded", "Approved", "Resolved", "Found",
      "Returned", "Completed"
    ].includes(status)) {
      cssClass = "approved";
    } else if (status === "Rejected") {
      cssClass = "rejected";
    } else if ([
      "Submitted", "Reported", "Under Review", "Office Processing"
    ].includes(status)) {
      cssClass = "processing";
    }

    return `<span class="status ${cssClass}">${esc(status)}</span>`;
  }

  function updateProfile() {
    const user = getUser();
    if (!user) return;

    const initial = (user.fullName.trim()[0] || "U").toUpperCase();

    $("profileName").textContent = user.fullName;
    $("profileIdentifier").textContent = user.identifier;
    $("sidebarUserName").textContent = user.fullName;
    $("sidebarUserIdentifier").textContent = user.identifier;
    $("profileAvatar").textContent = initial;
    $("topAvatar").textContent = initial;
    $("roleSelect").value = role();
  }

  function renderNav() {
    $("navList").innerHTML = navConfig[role()].map(section =>
      `<div class="nav-heading">${esc(section.group)}</div>` +
      section.items.map(([id, icon, label]) => {
        let count = "";

        if (role() === "student" && id === "requests") {
          count = `<span class="nav-count">${
            allRequests().filter(r =>
              r.ownerId === getUser().identifier
            ).length
          }</span>`;
        }

        return `
          <button class="nav-btn ${id === page ? "active" : ""}"
                  data-page="${id}" type="button">
            <span class="nav-icon">${icon}</span>
            <span>${esc(label)}</span>
            ${count}
          </button>
        `;
      }).join("")
    ).join("");
  }

  function closeSidebar() {
    $("sidebar").classList.remove("open");
    $("sidebarScrim").classList.remove("show");
  }

  function navigate(id, remember = true) {
    const allowed = navConfig[role()].flatMap(
      section => section.items.map(item => item[0])
    );

    const specialPages = [
      "classroom-form", "events-form", "lostfound-form"
    ];

    if (!allowed.includes(id) && !specialPages.includes(id)) {
      toast("This page is not available in this workspace.");
      return;
    }

    if (remember && id !== page) history.push(page);

    page = id;
    renderNav();
    renderPage();
    closeSidebar();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function welcome(tag, heading, description) {
    return `
      <section class="welcome">
        <div class="eyebrow">${esc(tag)}</div>
        <h1>${heading}</h1>
        <p>${esc(description)}</p>
      </section>
    `;
  }

  function stat(label, value, description) {
    return `
      <article class="stat-card">
        <span>${esc(label)}</span>
        <strong>${value}</strong>
        <small>${esc(description)}</small>
      </article>
    `;
  }

  function feature(icon, heading, description, target) {
    return `
      <article class="feature-card" tabindex="0" role="button"
               data-go="${target}">
        <div class="feature-symbol">${icon}</div>
        <h3>${esc(heading)}</h3>
        <p>${esc(description)}</p>
      </article>
    `;
  }

  function fileLink(item) {
    if (!item.fileData) return "";

    return `
      <p>
        <strong>Attachment:</strong>
        <a class="file-link"
           href="${item.fileData}"
           download="${esc(item.fileName || "attachment")}">
          ${esc(item.fileName || "Download file")}
        </a>
      </p>
    `;
  }

  function requestCard(item, allowActions = false) {
    let actionHtml = "";

    if (
      allowActions &&
      role() === "faculty" &&
      canFacultyReview(item)
    ) {
      actionHtml = `
        <div class="action-row">
          <button class="primary-btn"
                  data-action="faculty-approve"
                  data-id="${esc(item.id)}">
            ${item.type === "Classroom Issue"
              ? "Mark Resolved"
              : "Approve Event"}
          </button>
          <button class="danger-btn"
                  data-action="reject"
                  data-id="${esc(item.id)}">
            Reject
          </button>
        </div>
      `;
    }

    if (
      allowActions &&
      role() === "office" &&
      isBonafide(item) &&
      ["Submitted", "Office Processing"].includes(item.status)
    ) {
      actionHtml = `
        <div class="action-row">
          ${item.status === "Submitted" ? `
            <button class="secondary-btn"
                    data-action="processing"
                    data-id="${esc(item.id)}">
              Mark Processing
            </button>
          ` : ""}
          <button class="primary-btn"
                  data-action="office-approve"
                  data-id="${esc(item.id)}">
            Approve Bonafide
          </button>
          <button class="danger-btn"
                  data-action="reject"
                  data-id="${esc(item.id)}">
            Reject
          </button>
        </div>
      `;
    }

    if (
      allowActions &&
      role() === "office" &&
      isLostFound(item) &&
      !["Found", "Returned", "Completed"].includes(item.status)
    ) {
      actionHtml = `
        <div class="action-row">
          <button class="secondary-btn"
                  data-action="processing"
                  data-id="${esc(item.id)}">
            Mark Under Review
          </button>
          <button class="primary-btn"
                  data-action="found"
                  data-id="${esc(item.id)}">
            Mark Found / Returned
          </button>
        </div>
      `;
    }

    const lostFoundDetails = isLostFound(item) ? `
      <p><strong>Date lost / found:</strong>
        ${esc(item.itemDate || "Not specified")}</p>
      <p><strong>Item details:</strong>
        ${esc(item.itemDescription || item.description)}</p>
      ${item.foundMessage ? `
        <div class="notice">
          <strong>📢 Campus-wide update from Office</strong>
          <p>${esc(item.foundMessage)}</p>
          ${item.lastUpdated
            ? `<p>Updated: ${esc(item.lastUpdated)}</p>`
            : ""}
        </div>
      ` : ""}
      ${item.fileData && item.fileType?.startsWith("image/") ? `
        <p><strong>Item photo:</strong></p>
        <img src="${item.fileData}" alt="Photo of ${esc(item.title)}"
             style="display:block;width:min(100%,340px);max-height:260px;object-fit:cover;border-radius:14px;border:1px solid #294564;margin-top:10px">
      ` : ""}
    ` : "";

    return `
      <article class="notice">
        <strong>${esc(item.title)}</strong>
        <p>${esc(item.type)} · ${statusBadge(item.status)}</p>
        <p>${esc(item.description)}</p>
        ${lostFoundDetails}
        <p>
          Submitted by ${esc(item.ownerName)}
          (${esc(item.ownerId)}) · ${esc(item.createdAt)}
        </p>
        ${item.location
          ? `<p><strong>Location:</strong> ${esc(item.location)}</p>`
          : ""}
        ${!isLostFound(item) ? fileLink(item) : ""}
        ${actionHtml}
      </article>
    `;
  }

  /* Attendance */

  function attendanceData() {
    let data = getData(ATT_KEY, null);

    if (!data) {
      data = [
        { id: "STU001", name: "Aarav Kumar", total: 100, present: 82 },
        { id: "STU002", name: "Diya Sharma", total: 100, present: 76 },
        { id: "STU003", name: "Ishaan Patel", total: 100, present: 68 },
        { id: "STU004", name: "Meera Nair", total: 100, present: 91 },
        { id: "STU005", name: "Rohan Das", total: 100, present: 79 }
      ];
      saveData(ATT_KEY, data);
    }

    return data;
  }

  function attendancePercent(record) {
    return record.total
      ? Math.round(record.present / record.total * 100)
      : 0;
  }

  function renderAttendance() {
    const data = attendanceData();
    const user = getUser();

    if (role() === "student") {
      let record = data.find(item => item.id === user.identifier);

      if (!record) {
        record = {
          id: user.identifier,
          name: user.fullName,
          total: 100,
          present: 82
        };
        data.push(record);
        saveData(ATT_KEY, data);
      }

      const percent = attendancePercent(record);

      return `
        <section class="panel">
          <h2>My Attendance</h2>
          <p>Your attendance percentage for the current demo term.</p>
          <div class="stats-grid">
            ${stat("Attendance", percent + "%", "Present / total classes")}
            ${stat("Classes Attended", record.present, "Recorded present")}
            ${stat("Total Classes", record.total, "Recorded classes")}
          </div>
          <div class="notice">
            <strong>${percent <= 76
              ? "⚠ Attendance Alert"
              : "Attendance Status"}</strong>
            <p>${percent <= 76
              ? `Your attendance is ${percent}%, which is 76% or below. Please improve your attendance.`
              : "Your attendance is above 76%. Keep it up."}</p>
          </div>
        </section>
      `;
    }

    const average = data.length
      ? Math.round(data.reduce(
          (sum, item) => sum + attendancePercent(item), 0
        ) / data.length)
      : 0;

    const uploads = allRequests().filter(isUploadOnly);

    return `
      <section class="panel">
        <h2>Class Attendance</h2>
        <p>Faculty overview of student attendance and OD/Leave uploads.</p>
        <div class="stats-grid">
          ${stat("Class Average", average + "%", "Average across demo class")}
          ${stat("OD Uploads",
            uploads.filter(r => r.type === "On-Duty (OD)").length,
            "Documents uploaded")}
          ${stat("Leave Uploads",
            uploads.filter(r => r.type === "Leave Permission").length,
            "Documents uploaded")}
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Student</th><th>ID</th><th>Present</th>
                <th>Total</th><th>Attendance</th><th>Adjust</th>
              </tr>
            </thead>
            <tbody>
              ${data.map(item => `
                <tr>
                  <td>${esc(item.name)}</td>
                  <td>${esc(item.id)}</td>
                  <td>${item.present}</td>
                  <td>${item.total}</td>
                  <td>${attendancePercent(item)}%
                    ${attendancePercent(item) <= 76 ? "⚠" : ""}
                  </td>
                  <td>
                    <button class="secondary-btn" data-att="present"
                            data-id="${esc(item.id)}">+ Present</button>
                    <button class="secondary-btn" data-att="total"
                            data-id="${esc(item.id)}">+ Class</button>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  /* Submission forms */

  function renderRequestForm(kind) {
    const user = getUser();

    const configs = {
      submit: {
        title: "Submit a Request",
        types: [
          "On-Duty (OD)",
          "Leave Permission",
          "Bonafide Certificate",
          "Other"
        ]
      },
      classroom: {
        title: "Report a Classroom Issue",
        types: ["Classroom Issue"]
      },
      events: {
        title: "Submit an Event Proposal",
        types: ["Event Idea"]
      },
      lostfound: {
        title: "Add a Lost & Found Listing",
        types: ["Lost item", "Found item"]
      }
    };

    const config = configs[kind];
    const isLF = kind === "lostfound";

    $page().innerHTML = `
      <section class="panel">
        <h2>${config.title}</h2>
        <p>${isLF
          ? "Add the item details, date, location, and photo. The listing will be shared with the whole college."
          : kind === "submit"
            ? "OD and Leave only upload documents. Bonafide applications go directly to Office."
            : "Complete the details below to submit your record."}</p>

        <form id="requestForm" class="form-grid">
          <label class="field">
            <span>${isLF ? "Item name / title" : "Title"}</span>
            <input id="reqTitle" required maxlength="140"
                   placeholder="${isLF ? "e.g. Black water bottle" : "Enter a short title"}">
          </label>

          <label class="field">
            <span>Category</span>
            <select id="reqType">
              ${config.types.map(type =>
                `<option value="${esc(type)}">${esc(type)}</option>`
              ).join("")}
            </select>
          </label>

          ${isLF ? `
            <label class="field">
              <span>Date lost / found</span>
              <input id="itemDate" type="date" required>
            </label>
          ` : `
            <label class="field">
              <span>Date (optional)</span>
              <input id="reqDate" type="date">
            </label>
          `}

          <label class="field">
            <span>${isLF ? "Location where lost / found" : "Location (optional)"}</span>
            <input id="reqLocation" maxlength="180"
                   placeholder="${isLF ? "Building, classroom, canteen..." : "Building or room"}">
          </label>

          <label class="field full">
            <span>${isLF ? "Item description and identifying details" : "Description / reason"}</span>
            <textarea id="reqDescription" required maxlength="2500"
              placeholder="${isLF
                ? "Describe the item, colour, brand, identifying marks, and any details that can help identify it."
                : "Enter details"}"></textarea>
          </label>

          ${isLF ? `
            <label class="field full">
              <span>Item photo (required)</span>
              <input id="reqFile" type="file" accept="image/*" required>
            </label>
            <div class="notice full">
              <strong>📢 College-wide visibility</strong>
              <p>This listing will be visible from Student, Faculty, and Office workspaces in this browser demo. Office status updates will appear on the same listing for everyone.</p>
            </div>
          ` : `
            <label class="field full">
              <span>Upload document</span>
              <input id="reqFile" type="file"
                     accept=".pdf,.jpg,.jpeg,.png,.doc,.docx">
            </label>
          `}

          <div class="full action-row">
            <button class="primary-btn" type="submit">
              ${isLF ? "Publish College Listing" : "Submit"}
            </button>
            <button class="secondary-btn" type="button"
                    data-go="${isLF ? "lostfound" : kind === "submit" ? "dashboard" : kind}">
              Cancel
            </button>
          </div>
        </form>

        <p class="fine-print">Demo files are stored in this browser. Keep files under 900 KB.</p>
      </section>
    `;

    $("requestForm").addEventListener("submit", async event => {
      event.preventDefault();

      const type = $("reqType").value;
      const file = $("reqFile").files[0];

      if (isLF && (!file || !file.type.startsWith("image/"))) {
        return toast("Please select an item photo.");
      }

      if (isUploadOnly({ type }) && !file) {
        return toast("Please upload your OD or Leave document.");
      }

      if (file && file.size > FILE_LIMIT) {
        return toast("Please choose a file smaller than 900 KB.");
      }

      let fileData = "";

      if (file) {
        try {
          fileData = await readFile(file);
        } catch {
          return toast("Unable to read the selected file.");
        }
      }

      const itemDate = isLF ? $("itemDate").value : "";

      const status = isUploadOnly({ type })
        ? "Uploaded"
        : isLF ? "Reported" : "Submitted";

      const request = {
        id: uid(),
        ownerName: user.fullName,
        ownerId: user.identifier,
        ownerRole: role(),
        type,
        title: $("reqTitle").value.trim(),
        description: $("reqDescription").value.trim(),
        itemDescription: isLF ? $("reqDescription").value.trim() : "",
        itemDate,
        date: isLF ? itemDate : $("reqDate").value,
        location: $("reqLocation").value.trim(),
        status,
        foundMessage: "",
        createdAt: new Date().toLocaleString(),
        lastUpdated: "",
        fileName: file?.name || "",
        fileType: file?.type || "",
        fileData
      };

      const records = allRequests();
      records.unshift(request);

      try {
        saveData(DATA_KEY, records);
        toast(isLF
          ? "Listing published for the college demo!"
          : type === "Bonafide Certificate"
            ? "Bonafide application sent to Office."
            : isUploadOnly({ type })
              ? "Document uploaded successfully."
              : "Submission saved successfully.");

        if (isLF) {
          navigate("lostfound");
        } else if (kind === "submit") {
          navigate("requests");
        } else {
          navigate(kind);
        }
      } catch {
        toast("Storage is full. Try a smaller file.");
      }
    });
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /* Main pages */

  function renderPage() {
    const user = getUser();
    if (!user) return;

    const content = $page();
    const all = allRequests();
    const mine = all.filter(r => r.ownerId === user.identifier);
    const pendingFaculty = all.filter(canFacultyReview);
    const bonafide = all.filter(isBonafide);
    const officeBonafide = bonafide.filter(r =>
      ["Submitted", "Office Processing"].includes(r.status)
    );

    $("pageCrumb").textContent = titles[page] || "Dashboard";

    if (page === "dashboard") {
      if (role() === "student") {
        const active = mine.filter(r =>
          !["Completed", "Rejected", "Approved", "Found",
            "Returned", "Resolved", "Uploaded"].includes(r.status)
        );

        const attendance = attendanceData().find(
          r => r.id === user.identifier
        );
        const percent = attendance ? attendancePercent(attendance) : 82;

        content.innerHTML =
          welcome(
            "CAMPUS CONNECT · STUDENT WORKSPACE",
            `Welcome back, ${esc(user.fullName)} 👋`,
            "Your campus services, requests and updates in one connected space. Choose a service below to get started."
          ) +
          `<div class="stats-grid">
            ${stat("My Requests", mine.length, "Requests created in this demo")}
            ${stat("Attendance", percent + "%", percent <= 76 ? "⚠ Attendance needs attention" : "Your current demo attendance")}
            ${stat("Campus Updates", "Ready", "Notices and services in one place")}
          </div>
          <h2 class="section-heading">Campus Services</h2>
          <div class="feature-grid">
            ${feature("▤", "Submit a Request", "OD, Leave and Bonafide applications.", "submit")}
            ${feature("▦", "Attendance", "Check your attendance and alerts.", "attendance")}
            ${feature("□", "Classroom Issues", "Report a classroom problem.", "classroom")}
            ${feature("⌕", "Lost & Found", "Find or report a lost item.", "lostfound")}
            ${feature("✳", "Events & Ideas", "Suggest a campus event.", "events")}
            ${feature("▧", "Notices & Brochures", "Campus announcements.", "notices")}
            ${feature("▤", "My Requests", "Track your submissions.", "requests")}
            ${feature("♙", "My Profile", "View your demo profile.", "profile")}
          </div>`;
      } else if (role() === "faculty") {
        const od = all.filter(r => r.type === "On-Duty (OD)").length;
        const leave = all.filter(r => r.type === "Leave Permission").length;

        content.innerHTML =
          welcome(
            "CAMPUS CONNECT · FACULTY WORKSPACE",
            "Faculty Dashboard",
            "Review classroom issues and event proposals, monitor attendance, and view student uploads."
          ) +
          `<div class="stats-grid">
            ${stat("Pending Reviews", pendingFaculty.length, "Classroom and event submissions")}
            ${stat("OD Uploads", od, "Uploaded documents · no approval needed")}
            ${stat("Leave Uploads", leave, "Uploaded documents · no approval needed")}
          </div>
          <h2 class="section-heading">Faculty Workspace</h2>
          <div class="feature-grid">
            ${feature("▤", "Review Requests", "Review classroom issues and event ideas.", "faculty-requests")}
            ${feature("▦", "Attendance", "View and adjust class attendance.", "attendance")}
            ${feature("♙", "Student Profiles", "Attendance and upload counts.", "students")}
            ${feature("□", "Classroom Issues", "Resolve classroom reports.", "classroom")}
            ${feature("✳", "Event Proposals", "Approve or reject event ideas.", "events")}
            ${feature("⌕", "Lost & Found", "View college-wide item listings.", "lostfound")}
          </div>`;
      } else {
        content.innerHTML =
          welcome(
            "CAMPUS CONNECT · OFFICE WORKSPACE",
            "Office Dashboard",
            "Manage Bonafide applications and keep Lost & Found listings updated for the college."
          ) +
          `<div class="stats-grid">
            ${stat("Bonafide Pending", officeBonafide.length, "Awaiting Office action")}
            ${stat("Lost & Found", all.filter(isLostFound).length, "Shared item listings")}
            ${stat("Decisions", bonafide.filter(r =>
              ["Approved", "Rejected"].includes(r.status)
            ).length, "Bonafide decisions recorded")}
          </div>
          <h2 class="section-heading">Office Workspace</h2>
          <div class="feature-grid">
            ${feature("▤", "Bonafide Requests", "Process, approve, or reject applications.", "office-requests")}
            ${feature("▧", "Bonafide Certificates", "View all applications and decisions.", "certificates")}
            ${feature("⌕", "Lost & Found", "Update item status and publish campus messages.", "lostfound")}
            ${feature("▦", "Request Reports", "View Office records and uploads.", "reports")}
          </div>`;
      }
      return;
    }

    if (page === "profile") {
      content.innerHTML = `
        <section class="panel">
          <h2>My Profile</h2>
          <div class="notice">
            <p><strong>Name:</strong> ${esc(user.fullName)}</p>
            <p><strong>ID:</strong> ${esc(user.identifier)}</p>
            <p><strong>Role:</strong> ${esc(role())}</p>
          </div>
          <p>Role switching is provided for this jury demo.</p>
        </section>`;
      return;
    }

    if (page === "submit") {
      renderRequestForm("submit");
      return;
    }

    if (page === "classroom-form") {
      renderRequestForm("classroom");
      return;
    }

    if (page === "events-form") {
      renderRequestForm("events");
      return;
    }

    if (page === "lostfound-form") {
      renderRequestForm("lostfound");
      return;
    }

    if (page === "classroom") {
      const list = all.filter(r => r.type === "Classroom Issue");

      content.innerHTML = `
        <section class="panel">
          <h2>Classroom Issues</h2>
          <p>Student reports are routed to Faculty only.</p>
          ${role() === "student" ? `
            <div class="action-row">
              <button class="primary-btn" data-go="classroom-form">＋ Report Issue</button>
            </div>
          ` : ""}
          ${list.length
            ? list.map(r => requestCard(r, role() === "faculty")).join("")
            : `<div class="empty-state">No classroom issues reported yet.</div>`}
        </section>`;
      return;
    }

    if (page === "events") {
      const list = all.filter(r => r.type === "Event Idea");

      content.innerHTML = `
        <section class="panel">
          <h2>${role() === "faculty" ? "Event Proposals" : "Events & Ideas"}</h2>
          <p>Event ideas are routed to Faculty only.</p>
          ${role() === "student" ? `
            <div class="action-row">
              <button class="primary-btn" data-go="events-form">＋ Submit Event Idea</button>
            </div>
          ` : ""}
          ${list.length
            ? list.map(r => requestCard(r, role() === "faculty")).join("")
            : `<div class="empty-state">No event ideas submitted yet.</div>`}
        </section>`;
      return;
    }

    if (page === "lostfound") {
      const listings = all.filter(isLostFound);

      content.innerHTML = `
        <section class="panel">
          <h2>Lost & Found</h2>
          <p>
            College-wide demo listings. Students can post lost/found items.
            Faculty can view all listings. Office can update status and publish
            a message that appears on the shared listing.
          </p>
          ${role() !== "faculty" ? `
            <div class="action-row">
              <button class="primary-btn" data-go="lostfound-form">
                ＋ ${role() === "office" ? "Add Listing" : "Report Lost / Found Item"}
              </button>
            </div>
          ` : ""}
          ${listings.length
            ? listings.map(item =>
                requestCard(item, role() === "office")
              ).join("")
            : `<div class="empty-state">No items listed yet. Be the first to report one.</div>`}
        </section>`;
      return;
    }

    if (page === "requests") {
      content.innerHTML = `
        <section class="panel">
          <h2>My Requests</h2>
          <p>Track your requests, uploads, and status updates.</p>
          ${mine.length
            ? mine.map(r => requestCard(r)).join("")
            : `<div class="empty-state">You have not submitted anything yet.</div>`}
          <div class="action-row">
            <button class="primary-btn" data-go="submit">＋ Submit a Request</button>
          </div>
        </section>`;
      return;
    }

    if (page === "faculty-requests") {
      const list = all.filter(canFacultyReview);

      content.innerHTML = `
        <section class="panel">
          <h2>Review Requests</h2>
          <p>
            Only classroom issues and event ideas require Faculty review.
            OD/Leave are upload-only. Bonafide goes directly to Office.
          </p>
          ${list.length
            ? list.map(r => requestCard(r, true)).join("")
            : `<div class="empty-state">No pending Faculty requests.</div>`}
        </section>`;
      return;
    }

    if (page === "office-requests" || page === "certificates") {
      const list = page === "certificates" ? bonafide : officeBonafide;

      content.innerHTML = `
        <section class="panel">
          <h2>${titles[page]}</h2>
          <p>Bonafide applications are handled by Office only.</p>
          ${list.length
            ? list.map(r => requestCard(r, role() === "office")).join("")
            : `<div class="empty-state">No Bonafide applications in this list.</div>`}
        </section>`;
      return;
    }

    if (page === "reports") {
      const list = all.filter(r =>
        isBonafide(r) || isUploadOnly(r) || isLostFound(r)
      );

      content.innerHTML = `
        <section class="panel">
          <h2>Request Reports</h2>
          <p>Office reporting view for Bonafide, uploads, and Lost & Found.</p>
          ${list.length
            ? list.map(r => requestCard(r)).join("")
            : `<div class="empty-state">No records available.</div>`}
        </section>`;
      return;
    }

    if (page === "attendance") {
      content.innerHTML = renderAttendance();
      return;
    }

    if (page === "students") {
      const records = attendanceData();

      content.innerHTML = `
        <section class="panel">
          <h2>Student Profiles</h2>
          <p>Attendance and OD/Leave upload counts.</p>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Name</th><th>ID</th><th>Attendance</th>
                  <th>OD Uploads</th><th>Leave Uploads</th>
                </tr>
              </thead>
              <tbody>
                ${records.map(item => `
                  <tr>
                    <td>${esc(item.name)}</td>
                    <td>${esc(item.id)}</td>
                    <td>${attendancePercent(item)}%
                      ${attendancePercent(item) <= 76 ? "⚠" : ""}
                    </td>
                    <td>${all.filter(r =>
                      r.ownerId === item.id && r.type === "On-Duty (OD)"
                    ).length}</td>
                    <td>${all.filter(r =>
                      r.ownerId === item.id && r.type === "Leave Permission"
                    ).length}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </section>`;
      return;
    }

    if (page === "notices") {
      content.innerHTML = `
        <section class="panel">
          <h2>Notices & Brochures</h2>
          <div class="notice">
            <strong>Welcome to UniHub — Campus Connect</strong>
            <p>This demo area is ready for campus announcements and brochures.</p>
          </div>
        </section>`;
    }
  }

  /* Office actions and campus-wide Lost & Found updates */

  function handleAction(button) {
    const records = allRequests();
    const item = records.find(r => r.id === button.dataset.id);
    if (!item) return;

    const action = button.dataset.action;
    let valid = false;

    if (role() === "faculty" && canFacultyReview(item)) {
      if (action === "faculty-approve") {
        item.status = item.type === "Classroom Issue"
          ? "Resolved"
          : "Approved";
        valid = true;
      }

      if (action === "reject") {
        item.status = "Rejected";
        valid = true;
      }
    }

    if (role() === "office" && isBonafide(item)) {
      if (action === "processing" && item.status === "Submitted") {
        item.status = "Office Processing";
        valid = true;
      }

      if (
        action === "office-approve" &&
        ["Submitted", "Office Processing"].includes(item.status)
      ) {
        item.status = "Approved";
        valid = true;
      }

      if (
        action === "reject" &&
        ["Submitted", "Office Processing"].includes(item.status)
      ) {
        item.status = "Rejected";
        valid = true;
      }
    }

    if (role() === "office" && isLostFound(item)) {
      if (action === "processing") {
        item.status = "Under Review";
        item.foundMessage = "Office has reviewed this listing.";
        valid = true;
      }

      if (action === "found") {
        const defaultMessage = item.type === "Lost item"
          ? "This item has been found. Please contact the college office to arrange collection."
          : "This item has been recorded as found. Please contact the college office for collection details.";

        const message = window.prompt(
          "Enter the message to share with everyone:",
          defaultMessage
        );

        if (message === null) return;

        item.status = "Found";
        item.foundMessage = message.trim() || defaultMessage;
        valid = true;
      }
    }

    if (!valid) {
      toast("This action is not allowed for this role or status.");
      return;
    }

    item.lastUpdated = new Date().toLocaleString();

    try {
      saveData(DATA_KEY, records);
      renderNav();
      renderPage();
      toast(isLostFound(item)
        ? "Lost & Found update saved to the shared listing."
        : "Status updated: " + item.status);
    } catch {
      toast("Could not save this change.");
    }
  }

  /* Global event listeners */

  document.addEventListener("click", event => {
    const navButton = event.target.closest("[data-page]");

    if (navButton) {
      navigate(navButton.dataset.page);
      return;
    }

    const goButton = event.target.closest("[data-go]");

    if (goButton) {
      const target = goButton.dataset.go;

      if (
        ["classroom-form", "events-form", "lostfound-form"].includes(target)
      ) {
        if (role() !== "student" && target !== "lostfound-form") {
          toast("This form is for students.");
          return;
        }

        if (target === "lostfound-form" && role() === "faculty") {
          toast("Faculty can view the shared listings.");
          return;
        }
      }

      navigate(target);
      return;
    }

    const attendanceButton = event.target.closest("[data-att]");

    if (attendanceButton) {
      if (role() !== "faculty") {
        toast("Only Faculty can adjust demo attendance.");
        return;
      }

      const records = attendanceData();
      const record = records.find(
        r => r.id === attendanceButton.dataset.id
      );

      if (!record) return;

      if (attendanceButton.dataset.att === "present") {
        record.present = Math.min(record.total, record.present + 1);
      } else if (attendanceButton.dataset.att === "total") {
        record.total += 1;
      }

      saveData(ATT_KEY, records);
      renderPage();
      toast("Attendance record updated.");
      return;
    }

    const actionButton = event.target.closest("[data-action]");

    if (actionButton) handleAction(actionButton);
  });

  document.addEventListener("keydown", event => {
    if (
      (event.key === "Enter" || event.key === " ") &&
      event.target.matches(".feature-card[data-go]")
    ) {
      event.preventDefault();
      event.target.click();
    }
  });

  /* Login, role switching, logout */

  $("authForm").addEventListener("submit", event => {
    event.preventDefault();

    const fullName = $("authName").value.trim();
    const identifier = $("authIdentifier").value.trim();

    if (!fullName || !identifier) {
      const message = $("authMessage");
      message.textContent = "Enter both your name and ID.";
      message.classList.remove("hidden");
      return;
    }

    const user = { fullName, identifier, role: "student" };
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    login(user);
  });

  function login() {
    $("authScreen").classList.add("hidden");
    $("appShell").classList.remove("hidden");
    updateProfile();
    renderNav();
    navigate("dashboard", false);
  }

  function logout() {
    sessionStorage.removeItem(USER_KEY);
    history = [];
    page = "dashboard";
    $("appShell").classList.add("hidden");
    $("authScreen").classList.remove("hidden");
    $("authForm").reset();
    $("authMessage").classList.add("hidden");
    closeSidebar();
    $("authName").focus();
  }

  $("roleSelect").addEventListener("change", event => {
    const user = getUser();
    if (!user) return;

    user.role = event.target.value;
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));

    history = [];
    page = "dashboard";
    updateProfile();
    renderNav();
    navigate("dashboard", false);
    toast("Switched to " + user.role + " workspace.");
  });

  $("logoutBtn").addEventListener("click", logout);
  $("topLogoutBtn").addEventListener("click", logout);

  $("previousBtn").addEventListener("click", () => {
    const previous = history.pop();

    if (previous) {
      page = previous;
      renderNav();
      renderPage();
    } else {
      navigate("dashboard", false);
    }
  });

  $("menuToggle").addEventListener("click", () => {
    $("sidebar").classList.toggle("open");
    $("sidebarScrim").classList.add("show");
  });

  $("sidebarClose").addEventListener("click", closeSidebar);
  $("sidebarScrim").addEventListener("click", closeSidebar);

  $("currentDate").textContent = new Date().toLocaleDateString(
    undefined,
    { month: "short", day: "numeric", year: "numeric" }
  );

  $("currentYear").textContent = new Date().getFullYear();

  const existingUser = getUser();

  if (existingUser?.fullName && existingUser?.identifier) {
    login(existingUser);
  }
})();
