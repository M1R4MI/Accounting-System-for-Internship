const API_URL = "/api/table";
const tableBody = document.querySelector("#dataTable tbody");
const form = document.querySelector("#addForm");
const formTitle = document.getElementById("formHead");
const tableName = getTableNameFromURL();
let sortOrder = "asc";
const rowsPerPage = 20;
// Викликати при відкритті модального вікна додавання
document
  .getElementById("addModal")
  .addEventListener("show.bs.modal", async () => {
    // Визначаємо структуру поточної таблиці
    const tableRows = document.querySelectorAll("#dataTable tbody tr");
    let columns = [];
    if (tableRows.length > 0) {
      columns = Array.from(tableRows[0].children).map(
        (td) => td.getAttribute("data-col") || td.innerText.trim()
      );
    } else {
      // fallback: беремо з thead
      const ths = document.querySelectorAll("#dataTable thead th");
      columns = Array.from(ths)
        .map((th) => th.innerText.trim())
        .filter((name) => name !== "Дії");
    }
    // Визначаємо чи стандартна таблиця
    const standardColumns = [
      "ID",
      "RegistrationNumber",
      "RegistrationDate",
      "StudentName",
      "StudentGroup",
      "Information",
      "Contact",
      "DocumentType",
      "SigningStatus",
      "OccupationalSafety",
    ];
    const useStandard =
      columns.length === standardColumns.length &&
      standardColumns.every((col, i) => col === columns[i]);
  });

// Автоматична генерація таблиці залежно від стовпців
function table(data) {
  tableBody.innerHTML = "";
  if (!data || !data.length) return;
  const columns = Object.keys(data[0]);

  // Список "стандартних" стовпців і їх назви (з закоментованої версії)
  const standardColumns = [
    { key: "ID", name: "№" },
    { key: "RegistrationNumber", name: "Реєстр. номер" },
    { key: "StudentName", name: "ПІБ студента" },
    { key: "StudentGroup", name: "Група" },
    { key: "RegistrationDate", name: "Дата реєстрації" },
    { key: "Information", name: "Місце практики" },
    { key: "Contact", name: "Контактна особа" },
    { key: "DocumentType", name: "Вид документу" },
    { key: "SigningStatus", name: "Статус підписання" },
    { key: "OccupationalSafety", name: "Інструктаж з ОП" },
  ];

  const thead = tableBody.closest("table").querySelector("thead");
  let useStandard =
    columns.length === standardColumns.length &&
    standardColumns.every((col, i) => col.key === columns[i]);

  if (thead) {
    let headerRow = "<tr>";
    if (useStandard) {
      standardColumns.forEach((col) => {
        headerRow += `<th>${col.name}</th>`;
      });
    } else {
      columns.forEach((col) => {
        // Генеруємо власні назви (можна зробити красивіше)
        headerRow += `<th>${col}</th>`;
      });
    }
    headerRow += "<th>Дії</th></tr>";
    thead.innerHTML = headerRow;
  }

  data.forEach((row) => {
    const tr = document.createElement("tr");
    let tds = "";
    if (useStandard) {
      standardColumns.forEach((col) => {
        tds += `<td>${row[col.key] ?? ""}</td>`;
      });
    } else {
      columns.forEach((col) => {
        tds += `<td>${row[col] ?? ""}</td>`;
      });
    }
    // Додаємо стовпець з діями (Bootstrap Icons)
    tds += `<td style='align-items: center;'>
      <button class="btn btn-outline-primary btn-sm me-1" title="Редагувати" onclick='editRow(${JSON.stringify(row).replace(/"/g, "&quot;")})'>
        <i class="bi bi-pencil"></i>
      </button>
      <button class="btn btn-outline-danger btn-sm me-1" title="Видалити" onclick='deleteRow(${row.ID})'>
        <i class="bi bi-trash"></i>
      </button>
      <button class="btn btn-outline-secondary btn-sm" title="Клонувати" onclick='cloneRow(${row.ID})'>
        <i class="bi bi-files"></i>
      </button>
    </td>`;
    tr.innerHTML = tds;
    tableBody.appendChild(tr);
  });
  // Removed recursive loadTable();
}
// Отримати назву таблиці з параметра URL (наприклад, ?table=mainDataTable)
function getTableNameFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("tableName") || "name";
}

async function loadTable() {
  try {
    const res = await fetch(`${API_URL}/${encodeURIComponent(tableName)}`);
    const data = await res.json();
    table(data);
  } catch (err) {
    console.error("Failed to load table: ", err);
  }
}

function editRow(row) {
  // Заповнюємо поля модального вікна редагування
  document.getElementById("editId").value = row.ID;
  document.getElementById("editNameField").value = row["StudentName"] || "";
  document.getElementById("editGroup").value = row["StudentGroup"] || "";
  document.getElementById("editRegistrationDate").value = row["RegistrationDate"] || "";
  document.getElementById("editInformation").value = row["Information"] || "";
  document.getElementById("editContact").value = row["Contact"] || "";
  document.getElementById("editDocumentType").value = row["DocumentType"] || "";
  document.getElementById("editSigningStatus").value = row["SigningStatus"] || "";
  document.getElementById("editOp").value = row["OccupationalSafety"] || "";
  // Відкрити модальне вікно Bootstrap
  const editModal = new bootstrap.Modal(document.getElementById('editModal'));
  editModal.show();
}

async function deleteRow(id) {
  if (confirm("Ви дійсно хочете видалити цей рядок?")) {
    try {
      await fetch(`${API_URL}/${encodeURIComponent(tableName)}/${id}`, {
        method: "DELETE",
      });
      await loadTable();
    } catch (err) {
      console.error("Failed to delete row: ", err);
    }
  }
}

async function cloneRow(id) {
  try {
    await fetch(`${API_URL}/${encodeURIComponent(tableName)}/clone/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    await loadTable();
    console.log("Data cloned successfully!");
  } catch (err) {
    console.error("Error", err);
    console.log("Clone failed!");
  }
}

async function searchInTable() {
  const input = document.getElementById("searchInput").value;
  try {
    if (input !== "") {
      const res = await fetch(
        `${API_URL}/${encodeURIComponent(
          tableName
        )}/search/${encodeURIComponent(input)}`
      );
      const data = await res.json();
      if (data && data.length) {
        table(data);
      } else {
        alert("Нічого не знайдено!");
      }
    } else {
      loadTable();
    }
  } catch (err) {
    console.error("Search failed: ", err);
  }
}

async function performSearch(column, order = "DESC") {
  try {
    const res = await fetch(
      `${API_URL}/${encodeURIComponent(
        tableName
      )}/sort?by=${column}&order=${order}`
    );
    const data = await res.json();
    if (data != "") {
      table(data);
    } else {
      loadTable();
    }
  } catch (err) {
    console.error(err);
  }
}

function sortBy(column) {
  //sortOrder = (sortOrder === 'desc') ? 'asc' : 'desc'; // Toggle order
  // Мапінг для стандартних назв
  const columnMap = {
    name: "name",
    studentGroup: "studentGroup",
    registrationDate: "registrationDate",
  };
  performSearch(columnMap[column] || column, sortOrder);
  // document.getElementById("filterFormDiv").style.display = "none";
}

//Export function with redirection to the server
async function exportTable(tableName) {
  try {
    const res = await fetch(
      `${API_URL}/${encodeURIComponent(tableName)}/export`,
      {
        method: "GET",
      }
    );

    if (!res.ok) {
      throw new Error(`Server error: ${res.statusText}`);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${tableName}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Download failed: ", err);
    alert("Failed to download the Excel file.");
  }
}

//--Event listener for edit form--

const editForm = document.getElementById("editForm");
if (editForm) {
  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = document.getElementById("editId").value;
    const data = {
      StudentName: document.getElementById("editNameField").value,
      RegistrationDate: document.getElementById("editRegistrationDate").value,
      Information: document.getElementById("editInformation").value,
      Contact: document.getElementById("editContact").value,
      StudentGroup: document.getElementById("editGroup").value,
      DocumentType: document.getElementById("editDocumentType").value,
      SigningStatus: document.getElementById("editSigningStatus").value,
      OccupationalSafety: document.getElementById("editOp").value,
    };

    try {
      const res = await fetch(
        `${API_URL}/${encodeURIComponent(tableName)}/${id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );
      await res.json();
      await loadTable();
      // Закрити модальне вікно Bootstrap після збереження
      const editModal = bootstrap.Modal.getInstance(document.getElementById('editModal'));
      if (editModal) editModal.hide();
    } catch (err) {
      console.error("Error: ", err);
      console.log("Update failed!");
    }
  });
}

//--Event listener for add form--
// Safely attach add form submit handler only if the form exists on the page.
const addForm = document.getElementById("addForm");
// helper to safely read .value or return empty string
const getVal = (id) => {
  const el = document.getElementById(id);
  return el ? el.value : "";
};

if (addForm) {
  addForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const idEl = document.getElementById("id");
    const id = idEl ? idEl.value : "";
    const data = {
      StudentName: getVal("nameField"),
      RegistrationDate: getVal("registrationDate"),
      Information: getVal("information"),
      Contact: getVal("contact"),
      StudentGroup: getVal("group"),
      DocumentType: getVal("documentType"),
      SigningStatus: getVal("signingStatus"),
      OccupationalSafety: getVal("op"),
    };

    try {
      await fetch(`${API_URL}/${encodeURIComponent(tableName)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (form && typeof form.reset === "function") form.reset();
      if (idEl) idEl.value = "";
      await loadTable();
    } catch (err) {
      console.error("Failed to add row: ", err);
    }
  });
}

const exportBtn = document.getElementById("exportBtn");
if (exportBtn) {
  exportBtn.addEventListener('click', () => {
    exportTable(tableName);
  })
}

loadTable();
