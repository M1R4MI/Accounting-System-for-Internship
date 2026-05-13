const API_URL = "/api/table";
const tableBody = document.querySelector("#dataTable tbody");

// Назва таблиці береться з перехоплювача в table.html (рядок видалено з table.html, тому оголошуємо тут)
const tableName = new URLSearchParams(window.location.search).get('table') || window.location.pathname.split('/').pop();

let sortOrder = "asc";
const rowsPerPage = 20;

// Автоматична генерація таблиці залежно від стовпців
function table(data) {
  tableBody.innerHTML = "";
  if (!data || !data.length) return;

  data.forEach((row) => {
    const tr = document.createElement("tr");
    
    // Відображаємо дані відповідно до SQL-запиту
    tr.innerHTML = `
      <td>${row.ID ?? ""}</td>
      <td>${row.RegistrationNumber ?? ""}</td>
      <td>${row.RegistrationDate ?? ""}</td>
      <td>${row.StudentName ?? ""}</td>
      <td>${row.StudentGroup ?? ""}</td>
      <td>${row.Information ?? ""}</td>
      <td>${row.Contact ?? ""}</td>
      <td>${row.DocumentType ?? ""}</td>
      <td>${row.SigningStatus ?? ""}</td>
      <td>${row.OccupationalSafety ?? ""}</td>
      <td class="text-center">
        <button class="btn btn-sm btn-outline-info" onclick="openDocsModal(${row.ID})" title="Файли">
            <i class="bi bi-folder2-open"></i> Файли
        </button>
      </td>
      <td style='white-space: nowrap;'>
        <button class="btn btn-outline-primary btn-sm me-1" title="Редагувати" onclick='editRow(${JSON.stringify(row).replace(/"/g, "&quot;")})'>
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-outline-danger btn-sm me-1" title="Видалити" onclick='deleteRow(${row.ID})'>
          <i class="bi bi-trash"></i>
        </button>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

// Завантаження таблиці
async function loadTable() {
  try {
    const res = await fetch(`${API_URL}/${encodeURIComponent(tableName)}`);
    if(res.ok) {
        const data = await res.json();
        table(data);
    }
  } catch (err) {
    console.error("Failed to load table: ", err);
  }
}

// Функція для заповнення форми редагування
async function editRow(row) {
  document.getElementById("editId").value = row.ID;
  
  // Встановлюємо ID в приховане поле
  document.getElementById("editStudentId").value = row.student_id || "";
  
  // Встановлюємо гарний текст у поле пошуку
  const searchInput = document.getElementById("editStudentSearchInput");
  if(searchInput && row.StudentName && row.StudentGroup) {
      searchInput.value = `${row.StudentName} (${row.StudentGroup}) [ID:${row.student_id}]`;
  } else if (searchInput) {
      searchInput.value = "";
  }

  // Якщо дати у форматі DD-MM-YYYY, конвертуємо для input[type="date"] (YYYY-MM-DD)
  let dateVal = row.RegistrationDate || "";
  if (dateVal && dateVal.includes("-") && dateVal.split("-")[0].length === 2) {
      dateVal = dateVal.split('-').reverse().join('-');
  }
  document.getElementById("editRegistrationDate").value = dateVal;
  
  document.getElementById("editInformation").value = row.Information || "";
  document.getElementById("editContact").value = row.Contact || "";
  document.getElementById("editDocumentType").value = row.DocumentType || "";
  document.getElementById("editSigningStatus").value = row.SigningStatus || "";
  document.getElementById("editOp").value = row.OccupationalSafety || "";
  
  const editModal = new bootstrap.Modal(document.getElementById("editModal"));
  editModal.show();
}

// Видалення рядка
async function deleteRow(id) {
  if (confirm("Ви дійсно хочете видалити цей запис? Файли, прив'язані до нього, також будуть видалені!")) {
    try {
      const res = await fetch(`${API_URL}/${encodeURIComponent(tableName)}/${id}`, {
        method: "DELETE",
      });
      if(res.ok) await loadTable();
    } catch (err) {
      console.error("Failed to delete row: ", err);
    }
  }
}

// Пошук
async function searchInTable() {
  const input = document.getElementById("searchInput").value;
  try {
    if (input !== "") {
      const res = await fetch(`${API_URL}/${encodeURIComponent(tableName)}/search/${encodeURIComponent(input)}`);
      const data = await res.json();
      if (data && data.length) {
        table(data);
      } else {
        tableBody.innerHTML = "<tr><td colspan='12' class='text-center'>Нічого не знайдено!</td></tr>";
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
    const res = await fetch(`${API_URL}/${encodeURIComponent(tableName)}/sort?by=${column}&order=${order}`);
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
  sortOrder = (sortOrder === 'desc') ? 'asc' : 'desc'; // Toggle order
  performSearch(column, sortOrder);
}

// Експорт Excel
async function exportTable(tableName) {
  try {
    const res = await fetch(`${API_URL}/${encodeURIComponent(tableName)}/export`, { method: "GET" });
    if (!res.ok) throw new Error(`Server error: ${res.statusText}`);

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tableName}_відомість.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Download failed: ", err);
    alert("Помилка при завантаженні Excel файлу.");
  }
}

//-- Обробка форми РЕДАГУВАННЯ --
const editForm = document.getElementById("editForm");
if (editForm) {
  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = document.getElementById("editId").value;
    
    // Збираємо дані, надсилаючи student_id замість тексту
    const data = {
      student_id: document.getElementById("edit_student_id").value,
      RegistrationDate: document.getElementById("editRegistrationDate").value,
      Information: document.getElementById("editInformation").value,
      Contact: document.getElementById("editContact").value,
      DocumentType: document.getElementById("editDocumentType").value,
      SigningStatus: document.getElementById("editSigningStatus").value,
      OccupationalSafety: document.getElementById("editOccupationalSafety").value,
    };

    try {
      const res = await fetch(`${API_URL}/${encodeURIComponent(tableName)}/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
      });
      if(res.ok) {
          await loadTable();
          bootstrap.Modal.getInstance(document.getElementById("editModal")).hide();
      } else {
          alert((await res.json()).error || 'Помилка оновлення');
      }
    } catch (err) {
      console.error("Error: ", err);
    }
  });
}

//-- Обробка форми ДОДАВАННЯ --
const addForm = document.getElementById("addForm");

if (addForm) {
  addForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    // Збираємо дані для нової структури БД
    const data = {
      student_id: document.getElementById("student_id").value,
      RegistrationDate: document.getElementById("RegistrationDate").value,
      Information: document.getElementById("Information").value,
      Contact: document.getElementById("Contact").value,
      DocumentType: document.getElementById("DocumentType").value,
      SigningStatus: document.getElementById("SigningStatus").value,
      OccupationalSafety: document.getElementById("OccupationalSafety").value,
    };

    try {
      const res = await fetch(`${API_URL}/${encodeURIComponent(tableName)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      
      if(res.ok) {
          addForm.reset();
          bootstrap.Modal.getInstance(document.getElementById("addModal")).hide();
          await loadTable();
      } else {
          alert((await res.json()).error || 'Помилка додавання');
      }
    } catch (err) {
      console.error("Failed to add row: ", err);
    }
  });
}

// Кнопка експорту
const exportBtn = document.getElementById("exportBtn");
if (exportBtn) {
  exportBtn.addEventListener("click", () => exportTable(tableName));
}

// Завантажуємо таблицю при старті
loadTable();