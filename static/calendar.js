/**
 * calendar.js
 * Handles all interactive calendar logic for both the employee
 * and admin dashboards.  PAGE_TYPE and WEEK_START are injected
 * as global variables by each template's <script> block.
 */

document.addEventListener("DOMContentLoaded", function () {
  if (typeof PAGE_TYPE === "undefined") return;
  if (PAGE_TYPE === "employee") initEmployee();
  if (PAGE_TYPE === "admin")    initAdmin();
});

/* ============================================================
   SHARED UTILITIES
   ============================================================ */

/** Apply available / unavailable colour class to a cell. */
function setCellAvailability(cell, available) {
  cell.classList.toggle("available", available);
  cell.classList.toggle("unavail",  !available);
  cell.dataset.available = available ? "true" : "false";
}

/* ============================================================
   EMPLOYEE PAGE
   ============================================================ */

function initEmployee() {
  // Fetch saved availability and paint the grid
  loadMyAvailability();

  // Toggle cells on click
  document.querySelectorAll(".toggleable").forEach(function (cell) {
    cell.addEventListener("click", function () {
      setCellAvailability(cell, cell.dataset.available !== "true");
    });
  });

  // Save button
  var saveBtn = document.getElementById("save-btn");
  if (saveBtn) saveBtn.addEventListener("click", saveMyAvailability);
}

function loadMyAvailability() {
  fetch("/employee/availability")
    .then(function (r) { return r.json(); })
    .then(function (data) {
      document.querySelectorAll(".toggleable").forEach(function (cell) {
        var key = cell.dataset.day + "_" + cell.dataset.slot;
        setCellAvailability(cell, data[key] === true);
      });
    })
    .catch(function (err) {
      console.error("Could not load availability:", err);
    });
}

function saveMyAvailability() {
  var slots = [];
  document.querySelectorAll(".toggleable").forEach(function (cell) {
    slots.push({
      day:       parseInt(cell.dataset.day, 10),
      slot:      cell.dataset.slot,
      available: cell.dataset.available === "true",
    });
  });

  fetch("/employee/availability", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ slots: slots }),
  })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data.status === "ok") {
        showToast("✓ Availability saved!", "success");
      } else {
        showToast("✗ Could not save. Try again.", "error");
      }
    })
    .catch(function () {
      showToast("✗ Network error.", "error");
    });
}

function showToast(message, type) {
  var toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.className   = "toast toast-" + type;
  toast.style.display = "block";
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(function () {
    toast.style.display = "none";
  }, 3200);
}

/* ============================================================
   ADMIN PAGE
   ============================================================ */

var activeUserId   = null;
var activeUserName = "";

function initAdmin() {
  // ── Employee search filter ────────────────────────────────
  var searchInput = document.getElementById("employee-search");
  var allItems    = document.querySelectorAll(".employee-item");

  if (searchInput) {
    searchInput.addEventListener("input", function () {
      var q = searchInput.value.toLowerCase();
      allItems.forEach(function (li) {
        li.style.display = li.dataset.name.toLowerCase().includes(q) ? "" : "none";
      });
    });
  }

  // ── Employee selection ────────────────────────────────────
  allItems.forEach(function (li) {
    li.addEventListener("click", function () {
      allItems.forEach(function (i) { i.classList.remove("selected"); });
      li.classList.add("selected");

      activeUserId   = li.dataset.userId;
      activeUserName = li.dataset.name;

      var nameEl = document.getElementById("export-employee-name");
      if (nameEl) nameEl.textContent = activeUserName;

      loadAdminView(activeUserId);
    });
  });

  // ── Admin cell click (assign / remove shift) ──────────────
  document.querySelectorAll(".admin-cell").forEach(function (cell) {
    cell.addEventListener("click", function () {
      onAdminCellClick(cell);
    });
  });

  // ── Export button ─────────────────────────────────────────
  var exportBtn = document.getElementById("export-btn");
  if (exportBtn) exportBtn.addEventListener("click", doExport);
}

/** Fetch and render one employee's availability + shifts. */
function loadAdminView(userId) {
  fetch("/admin/availability/" + userId)
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var noMsg  = document.getElementById("no-employee-msg");
      var target = document.getElementById("export-target");

      if (noMsg)  noMsg.style.display  = "none";
      if (target) target.style.display = "block";

      document.querySelectorAll(".admin-cell").forEach(function (cell) {
        var key   = cell.dataset.day + "_" + cell.dataset.slot;
        var avail = data.availability[key] === true;

        setCellAvailability(cell, avail);

        var badge = cell.querySelector(".shift-badge");
        if (data.shifts[key]) {
          badge.textContent    = "● " + data.shifts[key].branch_name;
          badge.style.display  = "inline-block";
          cell.dataset.shiftAssigned = "true";
        } else {
          badge.textContent    = "";
          badge.style.display  = "none";
          cell.dataset.shiftAssigned = "false";
        }
      });
    })
    .catch(function (err) {
      console.error("Could not load admin availability:", err);
    });
}

function onAdminCellClick(cell) {
  if (!activeUserId) return;

  var isAvailable = cell.classList.contains("available");
  var isAssigned  = cell.dataset.shiftAssigned === "true";

  // Only act on green (available) cells or already-assigned cells
  if (!isAvailable && !isAssigned) return;

  var branchSelect = document.getElementById("branch-select");
  var branchId     = branchSelect ? parseInt(branchSelect.value, 10) : null;

  if (!branchId) {
    alert("No branch selected or no branches exist. Run seed.py first.");
    return;
  }

  fetch("/admin/assign", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id:     parseInt(activeUserId, 10),
      day_of_week: parseInt(cell.dataset.day, 10),
      slot:        cell.dataset.slot,
      branch_id:   branchId,
      week_start:  WEEK_START,
    }),
  })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var badge = cell.querySelector(".shift-badge");
      if (data.status === "assigned") {
        badge.textContent    = "● " + data.branch_name;
        badge.style.display  = "inline-block";
        cell.dataset.shiftAssigned = "true";
      } else if (data.status === "removed") {
        badge.textContent    = "";
        badge.style.display  = "none";
        cell.dataset.shiftAssigned = "false";
      }
    })
    .catch(function (err) {
      console.error("Shift assignment failed:", err);
    });
}

/** Capture the calendar grid as a PNG and trigger download. */
function doExport() {
  if (!activeUserId) {
    alert("Please select an employee first.");
    return;
  }

  var target = document.getElementById("export-target");
  if (!target) return;

  // html2canvas is loaded from CDN in the admin template
  if (typeof html2canvas === "undefined") {
    alert("Export library not loaded. Check your internet connection.");
    return;
  }

  html2canvas(target, {
    backgroundColor: "#ffffff",
    scale:           2,
    useCORS:         true,
    logging:         false,
  }).then(function (canvas) {
    var safeName = activeUserName.replace(/\s+/g, "_");
    var filename = "schedule_" + WEEK_START + "_" + safeName + ".png";

    var link      = document.createElement("a");
    link.download = filename;
    link.href     = canvas.toDataURL("image/png");
    link.click();
  }).catch(function (err) {
    console.error("Export error:", err);
    alert("Export failed. Please try again.");
  });
}
