/**
 * calendar.js
 * Handles all interactive calendar logic for the employee and admin dashboards.
 * PAGE_TYPE and WEEK_START are injected as globals by each template's <script> block.
 */

document.addEventListener("DOMContentLoaded", function () {
  if (typeof PAGE_TYPE === "undefined") return;
  if (PAGE_TYPE === "employee") initEmployee();
  if (PAGE_TYPE === "admin")    initAdmin();
});

/* ============================================================
   SHARED UTILITIES
   ============================================================ */

function handleEmployeeItemClick(li) {
  var allItems  = document.querySelectorAll(".employee-item");
  var clickedId = parseInt(li.dataset.userId, 10);

  if (activeUserId === clickedId) {
    li.classList.remove("selected");
    activeUserId         = null;
    activeUserName       = "";
    activeUserAvailSet   = false;
    employeeAvailability = {};
    employeeShifts       = {};
    renderAllCells();
    return;
  }

  allItems.forEach(function (i) { i.classList.remove("selected"); });
  li.classList.add("selected");
  activeUserId       = clickedId;
  activeUserName     = li.dataset.name;
  activeUserAvailSet = (li.dataset.availSet === "true");
  loadEmployeeAvailability(activeUserId);
}

function setCellAvailability(cell, available) {
  cell.classList.toggle("available", available);
  cell.classList.toggle("unavail",  !available);
  cell.dataset.available = available ? "true" : "false";
}

function showToast(message, type) {
  var toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent   = message;
  toast.className     = "toast toast-" + type;
  toast.style.display = "block";
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(function () {
    toast.style.display = "none";
  }, 3800);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ============================================================
   EMPLOYEE PAGE
   ============================================================ */

function initEmployee() {
  loadMyAvailability();
  loadAccentColor();

  document.querySelectorAll(".toggleable").forEach(function (cell) {
    cell.addEventListener("click", function () {
      setCellAvailability(cell, cell.dataset.available !== "true");
    });
  });

  document.querySelectorAll(".color-swatch").forEach(function (btn) {
    btn.addEventListener("click", function () {
      saveAccentColor(btn.dataset.color);
    });
  });

  var saveBtn = document.getElementById("save-btn");
  if (saveBtn) saveBtn.addEventListener("click", saveMyAvailability);
}

function loadAccentColor() {
  fetch("/employee/accent-color")
    .then(function (r) { return r.json(); })
    .then(function (data) { highlightSwatch(data.accent_color || ""); })
    .catch(function () {});
}

function saveAccentColor(color) {
  highlightSwatch(color);
  fetch("/employee/accent-color", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ color: color }),
  })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data.status === "ok") showToast(T.toast_colour_saved, "success");
    })
    .catch(function () { showToast(T.toast_colour_err, "error"); });
}

function highlightSwatch(color) {
  document.querySelectorAll(".color-swatch").forEach(function (btn) {
    btn.classList.toggle("selected", btn.dataset.color === color);
  });
}

function loadMyAvailability() {
  fetch("/employee/availability")
    .then(function (r) { return r.json(); })
    .then(function (data) {
      document.querySelectorAll(".toggleable").forEach(function (cell) {
        var key = cell.dataset.day + "_" + cell.dataset.slot;
        setCellAvailability(cell, data[key] !== false);
      });
    })
    .catch(function (err) { console.error("Could not load availability:", err); });
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
        showToast(T.toast_saved, "success");
      } else {
        showToast(T.toast_save_err, "error");
      }
    })
    .catch(function () { showToast(T.toast_net_err, "error"); });
}

/* ============================================================
   ADMIN PAGE
   ============================================================ */

// Active branch context
var activeBranchId   = null;
var activeBranchName = "";

// Active employee overlay context (null = no employee selected)
var activeUserId       = null;
var activeUserName     = "";
var activeUserAvailSet = false;  // true = employee explicitly saved availability this week

// branchSchedule[slot_key] = [{user_id, full_name}, ...]
var branchSchedule = {};

// employeeAvailability[slot_key] = true | false
var employeeAvailability = {};

// employeeShifts[slot_key] = {branch_id, branch_name, at_this_branch}
var employeeShifts = {};

function initAdmin() {
  // Activate the first branch tab on load
  var firstTab = document.querySelector(".branch-tab");
  if (firstTab) {
    selectBranch(
      parseInt(firstTab.dataset.branchId, 10),
      firstTab.dataset.branchName
    );
  }

  // Branch tab clicks
  document.querySelectorAll(".branch-tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      selectBranch(
        parseInt(tab.dataset.branchId, 10),
        tab.dataset.branchName
      );
    });
  });

  // Employee search filter
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

  // Employee selection — click to select, click again to deselect
  allItems.forEach(function (li) {
    li.addEventListener("click", function () { handleEmployeeItemClick(li); });
  });

  // Cell click — assign / remove the active employee
  document.querySelectorAll(".admin-cell").forEach(function (cell) {
    cell.addEventListener("click", function () { onAdminCellClick(cell); });
  });

  // Export button
  var exportBtn = document.getElementById("export-btn");
  if (exportBtn) exportBtn.addEventListener("click", doExport);
}

/* ── Branch selection ──────────────────────────────────────── */

function selectBranch(branchId, branchName) {
  activeBranchId   = branchId;
  activeBranchName = branchName;

  // Highlight active tab
  document.querySelectorAll(".branch-tab").forEach(function (tab) {
    tab.classList.toggle("active", parseInt(tab.dataset.branchId, 10) === branchId);
  });

  // Update the calendar header title
  var titleEl = document.getElementById("export-branch-name");
  if (titleEl) titleEl.textContent = branchName;

  // Fetch both branch schedule and (if employee selected) employee availability in parallel
  var scheduleReq = fetch("/admin/branch/" + branchId + "/schedule")
    .then(function (r) { return r.json(); })
    .then(function (data) { branchSchedule = data.schedule || {}; });

  var availReq = activeUserId
    ? fetch("/admin/availability/" + activeUserId + "?branch_id=" + branchId)
        .then(function (r) { return r.json(); })
        .then(function (data) {
          employeeAvailability = data.availability || {};
          employeeShifts       = data.shifts || {};
        })
    : Promise.resolve();

  Promise.all([scheduleReq, availReq])
    .then(renderAllCells)
    .catch(function (err) { console.error("Error loading branch data:", err); });
}

/* ── Employee availability load ────────────────────────────── */

function loadEmployeeAvailability(userId) {
  fetch("/admin/availability/" + userId + "?branch_id=" + activeBranchId)
    .then(function (r) { return r.json(); })
    .then(function (data) {
      employeeAvailability = data.availability || {};
      employeeShifts       = data.shifts || {};
      renderAllCells();
    })
    .catch(function (err) { console.error("Could not load availability:", err); });
}

/* ── Cell rendering ────────────────────────────────────────── */

function renderAllCells() {
  document.querySelectorAll(".admin-cell").forEach(renderCell);
}

function renderCell(cell) {
  var key = cell.dataset.day + "_" + cell.dataset.slot;

  // ── Names of employees assigned to this branch/slot ──────
  var namesDiv = cell.querySelector(".cell-names");
  if (namesDiv) {
    var assigned = branchSchedule[key] || [];
    namesDiv.innerHTML = assigned.map(function (e) {
      var color   = e.accent_color || "#6366f1";
      var topStyle = "border-top: 3px solid " + color + ";";
      return '<span class="cell-name" style="' + topStyle + '">'
           + escapeHtml(e.full_name)
           + "</span>";
    }).join("");
  }

  // ── Background colour based on active employee's state ───
  cell.classList.remove("available", "unavail", "cell-assigned-here", "cell-neutral", "cell-assigned-elsewhere");

  if (!activeUserId) {
    cell.classList.add("cell-neutral");
    cell.dataset.shiftAssigned = "false";
    return;
  }

  var shift = employeeShifts[key];

  if (shift) {
    if (shift.at_this_branch) {
      // Employee is assigned HERE for this slot — blue
      cell.classList.add("cell-assigned-here");
      cell.dataset.shiftAssigned = "true";
    } else {
      // Employee already assigned at a different branch — grey (not an error, just busy)
      cell.classList.add("cell-assigned-elsewhere");
      cell.dataset.shiftAssigned = "false";
    }
  } else {
    // No shift — colour by own availability
    var avail = employeeAvailability[key] === true;
    cell.classList.add(avail ? "available" : "unavail");
    cell.dataset.shiftAssigned = "false";
  }
}

/* ── Cell click (assign / remove) ─────────────────────────── */

function onAdminCellClick(cell) {
  if (!activeUserId || !activeBranchId) return;

  var isAssignedHere = cell.dataset.shiftAssigned === "true";
  var isAvailable    = cell.classList.contains("available");
  var isUnavail      = cell.classList.contains("unavail");

  // Allow override of red cells only when the employee hasn't saved availability
  var canOverride = isUnavail && !activeUserAvailSet;

  // Block clicks on grey (assigned elsewhere) and red when availability was set
  if (!isAvailable && !isAssignedHere && !canOverride) return;

  var day  = parseInt(cell.dataset.day, 10);
  var slot = cell.dataset.slot;
  var key  = day + "_" + slot;

  fetch("/admin/assign", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id:     activeUserId,
      day_of_week: day,
      slot:        slot,
      branch_id:   activeBranchId,
      week_start:  WEEK_START,
    }),
  })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data.status === "assigned") {
        // Add to local branch schedule
        if (!branchSchedule[key]) branchSchedule[key] = [];
        var already = branchSchedule[key].find(function (e) { return e.user_id === activeUserId; });
        if (!already) {
          branchSchedule[key].push({ user_id: activeUserId, full_name: activeUserName });
        }
        employeeShifts[key] = {
          branch_id:      activeBranchId,
          branch_name:    activeBranchName,
          at_this_branch: true,
        };

      } else if (data.status === "removed") {
        // Remove from local branch schedule
        if (branchSchedule[key]) {
          branchSchedule[key] = branchSchedule[key].filter(function (e) {
            return e.user_id !== activeUserId;
          });
        }
        delete employeeShifts[key];

      } else if (data.error === "conflict") {
        showToast(
          T.conflict_msg
            .replace("{name}",   activeUserName)
            .replace("{branch}", data.branch_name),
          "error"
        );
      } else if (data.error === "slot_taken") {
        showToast(
          T.slot_taken_msg.replace("{name}", data.employee_name),
          "error"
        );
      }

      renderAllCells();
    })
    .catch(function (err) { console.error("Shift assignment failed:", err); });
}

/* ── Export ────────────────────────────────────────────────── */

function doExport() {
  if (!activeBranchId) {
    alert("No branch selected.");
    return;
  }

  var target = document.getElementById("export-target");
  if (!target) return;

  if (typeof html2canvas === "undefined") {
    alert("Export library not loaded. Check your internet connection.");
    return;
  }

  // Strip ALL colour states for a clean, uniform exported schedule.
  // Employee identity is conveyed by name + accent-colour stripe, not cell background.
  var cells    = Array.from(document.querySelectorAll(".admin-cell"));
  var snapshot = cells.map(function (cell) {
    return {
      available:         cell.classList.contains("available"),
      unavail:           cell.classList.contains("unavail"),
      assignedHere:      cell.classList.contains("cell-assigned-here"),
      assignedElsewhere: cell.classList.contains("cell-assigned-elsewhere"),
    };
  });
  cells.forEach(function (cell) {
    cell.classList.remove("available", "unavail", "cell-assigned-here", "cell-assigned-elsewhere");
    cell.classList.add("cell-neutral");
  });

  function restoreCells() {
    cells.forEach(function (cell, i) {
      cell.classList.remove("cell-neutral");
      if (snapshot[i].available)         cell.classList.add("available");
      if (snapshot[i].unavail)           cell.classList.add("unavail");
      if (snapshot[i].assignedHere)      cell.classList.add("cell-assigned-here");
      if (snapshot[i].assignedElsewhere) cell.classList.add("cell-assigned-elsewhere");
    });
  }

  html2canvas(target, {
    backgroundColor: "#1c1c38",
    scale:           2,
    useCORS:         true,
    logging:         false,
  }).then(function (canvas) {
    restoreCells();

    var safeBranch = activeBranchName.replace(/\s+/g, "_");
    var filename   = "schedule_" + WEEK_START + "_" + safeBranch + ".png";

    var link      = document.createElement("a");
    link.download = filename;
    link.href     = canvas.toDataURL("image/png");
    link.click();
  }).catch(function (err) {
    restoreCells();
    console.error("Export error:", err);
    alert("Export failed. Please try again.");
  });
}

/* ============================================================
   EMPLOYEE MANAGEMENT (admin only)
   ============================================================ */

// ── Add employee ─────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", function () {
  var addBtn     = document.getElementById("add-employee-btn");
  var modal      = document.getElementById("add-emp-modal");
  var cancelBtn  = document.getElementById("add-emp-cancel");
  var submitBtn  = document.getElementById("add-emp-submit");
  var doneBtn    = document.getElementById("add-emp-done");
  var formSec    = document.getElementById("add-emp-form-section");
  var successSec = document.getElementById("add-emp-success-section");
  var errMsg     = document.getElementById("add-emp-error");

  if (!addBtn) return;   // not on admin page

  function openAddModal() {
    document.getElementById("new-emp-fullname").value = "";
    document.getElementById("new-emp-username").value = "";
    errMsg.style.display = "none";
    formSec.style.display    = "block";
    successSec.style.display = "none";
    modal.style.display = "flex";
  }

  function closeAddModal() { modal.style.display = "none"; }

  addBtn.addEventListener("click", openAddModal);
  cancelBtn.addEventListener("click", closeAddModal);
  modal.addEventListener("click", function (e) {
    if (e.target === modal) closeAddModal();
  });

  // Auto-fill username from full name
  document.getElementById("new-emp-fullname").addEventListener("input", function () {
    var suggested = this.value.trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, "");
    document.getElementById("new-emp-username").value = suggested;
  });

  submitBtn.addEventListener("click", function () {
    var fullName = document.getElementById("new-emp-fullname").value.trim();
    var username = document.getElementById("new-emp-username").value.trim().toLowerCase();

    if (!fullName || !username) {
      errMsg.textContent = "Please fill in both fields.";
      errMsg.style.display = "block";
      return;
    }

    submitBtn.disabled = true;
    fetch("/admin/employees", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ full_name: fullName, username: username }),
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        submitBtn.disabled = false;
        if (!res.ok) {
          if (res.data.error === "username_taken") {
            errMsg.textContent = T.username_taken;
          } else {
            errMsg.textContent = res.data.error || "Error creating employee.";
          }
          errMsg.style.display = "block";
          return;
        }
        // Show credentials
        document.getElementById("new-emp-show-username").textContent = res.data.username;
        document.getElementById("new-emp-show-password").textContent = res.data.password;
        formSec.style.display    = "none";
        successSec.style.display = "block";

        // Append to list immediately
        var ul  = document.getElementById("employee-list");
        var li  = document.createElement("li");
        li.className = "employee-item";
        li.dataset.userId   = res.data.user_id;
        li.dataset.name     = res.data.full_name;
        li.dataset.availSet = "false";
        li.innerHTML =
          '<span class="emp-name">' + escapeHtml(res.data.full_name) + '</span>' +
          '<span class="avail-status avail-not-set">' + (typeof T !== "undefined" ? T.avail_not_set || "Availability not set" : "Availability not set") + '</span>' +
          '<button class="emp-remove-btn" data-user-id="' + res.data.user_id + '" data-name="' + escapeHtml(res.data.full_name) + '" onclick="event.stopPropagation(); confirmRemoveEmployee(this)">✕</button>';
        // attach selection listener
        li.addEventListener("click", function () { handleEmployeeItemClick(li); });
        ul.appendChild(li);
      })
      .catch(function () {
        submitBtn.disabled = false;
        errMsg.textContent = "Network error.";
        errMsg.style.display = "block";
      });
  });

  doneBtn.addEventListener("click", closeAddModal);
});

// ── Remove employee ──────────────────────────────────────────
var _pendingRemoveId   = null;
var _pendingRemoveName = null;

function confirmRemoveEmployee(btn) {
  _pendingRemoveId   = parseInt(btn.dataset.userId, 10);
  _pendingRemoveName = btn.dataset.name;

  var modal = document.getElementById("remove-emp-modal");
  document.getElementById("remove-emp-msg").textContent =
    T.remove_emp_msg.replace("{name}", _pendingRemoveName);
  modal.style.display = "flex";
}

document.addEventListener("DOMContentLoaded", function () {
  var modal      = document.getElementById("remove-emp-modal");
  var cancelBtn  = document.getElementById("remove-emp-cancel");
  var confirmBtn = document.getElementById("remove-emp-confirm");

  if (!modal) return;

  cancelBtn.addEventListener("click", function () { modal.style.display = "none"; });
  modal.addEventListener("click", function (e) {
    if (e.target === modal) modal.style.display = "none";
  });

  confirmBtn.addEventListener("click", function () {
    if (!_pendingRemoveId) return;
    confirmBtn.disabled = true;

    fetch("/admin/employees/" + _pendingRemoveId, { method: "DELETE" })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        confirmBtn.disabled = false;
        modal.style.display = "none";
        if (data.status === "removed") {
          // Remove from DOM
          var li = document.querySelector(".employee-item[data-user-id='" + _pendingRemoveId + "']");
          if (li) li.remove();
          // Deselect if was active
          if (activeUserId === _pendingRemoveId) {
            activeUserId       = null;
            activeUserName     = "";
            activeUserAvailSet = false;
            employeeAvailability = {};
            employeeShifts       = {};
            renderAllCells();
          }
          showToast(_pendingRemoveName + " removed.", "success");
        }
        _pendingRemoveId = _pendingRemoveName = null;
      })
      .catch(function () {
        confirmBtn.disabled = false;
        modal.style.display = "none";
        showToast("Network error.", "error");
      });
  });
});
