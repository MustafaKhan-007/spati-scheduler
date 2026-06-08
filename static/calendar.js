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

  document.querySelectorAll(".toggleable").forEach(function (cell) {
    cell.addEventListener("click", function () {
      setCellAvailability(cell, cell.dataset.available !== "true");
    });
  });

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
        showToast("✓ Availability saved!", "success");
      } else {
        showToast("✗ Could not save. Try again.", "error");
      }
    })
    .catch(function () { showToast("✗ Network error.", "error"); });
}

/* ============================================================
   ADMIN PAGE
   ============================================================ */

// Active branch context
var activeBranchId   = null;
var activeBranchName = "";

// Active employee overlay context (null = no employee selected)
var activeUserId   = null;
var activeUserName = "";

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
    li.addEventListener("click", function () {
      var clickedId = parseInt(li.dataset.userId, 10);

      if (activeUserId === clickedId) {
        // Deselect
        li.classList.remove("selected");
        activeUserId        = null;
        activeUserName      = "";
        employeeAvailability = {};
        employeeShifts       = {};
        renderAllCells();
        return;
      }

      allItems.forEach(function (i) { i.classList.remove("selected"); });
      li.classList.add("selected");
      activeUserId   = clickedId;
      activeUserName = li.dataset.name;

      loadEmployeeAvailability(activeUserId);
    });
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
      return '<span class="cell-name">' + escapeHtml(e.full_name) + "</span>";
    }).join("");
  }

  // ── Background colour based on active employee's state ───
  cell.classList.remove("available", "unavail", "cell-assigned-here", "cell-neutral");

  if (!activeUserId) {
    cell.classList.add("cell-neutral");
    cell.dataset.shiftAssigned = "false";
    return;
  }

  var shift = employeeShifts[key];

  if (shift) {
    if (shift.at_this_branch) {
      // Employee is assigned HERE for this slot
      cell.classList.add("cell-assigned-here");
      cell.dataset.shiftAssigned = "true";
    } else {
      // Employee is assigned elsewhere — show as conflict (red)
      cell.classList.add("unavail");
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

  // Only act on green (available) or the cell already assigned to this employee
  if (!isAvailable && !isAssignedHere) return;

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
          "✗ " + activeUserName + " is already assigned to \"" + data.branch_name + "\" for this slot.",
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

  // Strip availability overlay for a clean schedule export.
  // Cells assigned HERE keep their blue; everything else goes neutral.
  var cells    = Array.from(document.querySelectorAll(".admin-cell"));
  var snapshot = cells.map(function (cell) {
    return {
      available:   cell.classList.contains("available"),
      unavail:     cell.classList.contains("unavail"),
    };
  });
  cells.forEach(function (cell) {
    if (!cell.classList.contains("cell-assigned-here")) {
      cell.classList.remove("available", "unavail");
      cell.classList.add("cell-neutral");
    }
  });

  function restoreCells() {
    cells.forEach(function (cell, i) {
      if (!cell.classList.contains("cell-assigned-here")) {
        cell.classList.remove("cell-neutral");
        if (snapshot[i].available) cell.classList.add("available");
        if (snapshot[i].unavail)   cell.classList.add("unavail");
      }
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
