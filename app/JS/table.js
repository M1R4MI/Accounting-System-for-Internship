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
      <td>${row.record_book_number ?? ""}</td>
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
        <button class="btn btn-sm btn-outline-secondary me-1" onclick="cloneRecord(${row.ID})" title="Клонувати запис">
            <i class="bi bi-files"></i>
        </button>
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

// Функція клонування запису
async function cloneRecord(id) {
    if (!confirm("Ви впевнені, що хочете клонувати цей запис?\n\n(Файли та документи оригінального запису скопійовані НЕ будуть)")) {
        return;
    }
    
    try {
        const response = await fetch(`/api/table/${tableName}/clone/${id}`, {
            method: "POST"
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Перезавантажуємо таблицю, щоб побачити новий запис
            await loadTable(); // Або ваша функція оновлення даних таблиці (наприклад, searchTable(""))
            
            // Маленька підказка користувачу
            alert(`Успіх! Запис клоновано.\nНовий реєстраційний номер: ${data.RegistrationNumber}\n\nТепер натисніть "Редагувати" (олівець) на новому записі, щоб змінити студента.`);
        } else {
            alert("Помилка клонування: " + data.error);
        }
    } catch (error) {
        console.error("Помилка клонування:", error);
        alert("Не вдалося з'єднатися з сервером.");
    }
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
      student_id: document.getElementById("editStudentId").value,
      RegistrationDate: document.getElementById("editRegistrationDate").value,
      Information: document.getElementById("editInformation").value,
      Contact: document.getElementById("editContact").value,
      DocumentType: document.getElementById("editDocumentType").value,
      SigningStatus: document.getElementById("editSigningStatus").value,
      OccupationalSafety: document.getElementById("editOp").value,
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
      student_id: document.getElementById("studentId").value,
      RegistrationDate: document.getElementById("registrationDate").value,
      Information: document.getElementById("information").value,
      Contact: document.getElementById("contact").value,
      DocumentType: document.getElementById("documentType").value,
      SigningStatus: document.getElementById("signingStatus").value,
      OccupationalSafety: document.getElementById("op").value,
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

async function openDocsModal(recordId) {
    // 1. Зберігаємо ID рядка у приховане поле
    document.getElementById("docRowId").value = recordId;
    
    // 2. Очищаємо список та інпут перед завантаженням
    document.getElementById("uploadedDocsList").innerHTML = "";
    document.getElementById("uploadFile").value = "";
    
    // 3. Завантажуємо список вже існуючих файлів
    await loadUploadedDocs(recordId);
    
    // 4. Відкриваємо модалку
    const modal = new bootstrap.Modal(document.getElementById('docsModal'));
    modal.show();
}

// Завантаження списку файлів
async function loadUploadedDocs(recordId) {
    const list = document.getElementById("uploadedDocsList");
    try {
        const res = await fetch(`/api/documents/${encodeURIComponent(tableName)}/${recordId}`);
        const data = await res.json();

        list.innerHTML = "";
        if (!res.ok) throw new Error(data.error);

        if (data.length === 0) {
            list.innerHTML = '<li class="list-group-item text-center text-muted">Файлів немає</li>';
            return;
        }

        data.forEach(doc => {
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center';
            
            // НОВІ ПОСИЛАННЯ (звертаємось до нашого нового API)
            const viewUrl = `/api/documents/download/${doc.id}?action=view`;
            const downloadUrl = `/api/documents/download/${doc.id}?action=download`;
            
            const isPdf = doc.original_name.toLowerCase().endsWith('.pdf');
            const iconClass = isPdf ? 'bi-file-earmark-pdf text-danger' : 'bi-file-earmark-word text-primary';

            li.innerHTML = `
                <div class="text-truncate" style="max-width: 65%;">
                    <i class="bi ${iconClass} me-2"></i>
                    <span class="badge bg-secondary me-1">${doc.document_type}</span>
                    <span title="${doc.original_name}">${doc.original_name}</span>
                </div>
                <div class="btn-group btn-group-sm">
                    <!-- Кнопка "Переглянути" -->
                    <a href="${viewUrl}" target="_blank" class="btn btn-outline-primary" title="Відкрити">
                        <i class="bi bi-eye"></i>
                    </a>
                    <!-- Кнопка "Завантажити" -->
                    <a href="${downloadUrl}" class="btn btn-outline-success" title="Завантажити">
                        <i class="bi bi-download"></i>
                    </a>
                    <!-- Кнопка "Видалити" -->
                    <button type="button" class="btn btn-outline-danger" onclick="deleteDoc(${doc.id}, ${recordId})" title="Видалити">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            `;
            list.appendChild(li);
        });
    } catch (err) {
        list.innerHTML = `<li class="list-group-item text-danger">Помилка: ${err.message}</li>`;
    }
}

// ВИПРАВЛЕНО: Обробка форми завантаження
const uploadDocForm = document.getElementById("uploadDocForm");
if (uploadDocForm) {
    uploadDocForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        // 1. Беремо ID запису ВИКЛЮЧНО з прихованого поля (ніяких currentRecordId)
        const recordId = document.getElementById("docRowId").value;
        const fileInput = document.getElementById("uploadFile");
        const docType = document.getElementById("uploadDocType").value;

        if (!fileInput.files[0]) return alert("Оберіть файл!");

        const formData = new FormData();
        formData.append("file", fileInput.files[0]);
        formData.append("tableName", tableName);
        formData.append("recordId", recordId); // Передаємо правильну змінну recordId
        formData.append("documentType", docType);

        try {
            const res = await fetch("/api/documents/upload", {
                method: "POST",
                body: formData
            });
            const result = await res.json();

            if (res.ok) {
                fileInput.value = ""; // Очищаємо поле після успішного завантаження
                await loadUploadedDocs(recordId); // Оновлюємо список файлів, використовуючи recordId
            } else {
                alert("Помилка: " + result.error);
            }
        } catch (err) {
            alert("Не вдалося завантажити файл. Перевірте консоль.");
            console.error("Upload error:", err);
        }
    });
}

// Функція видалення
async function deleteDoc(docId, recordId) {
    if (!confirm("Видалити цей документ?")) return;
    try {
        const res = await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
        if (res.ok) await loadUploadedDocs(recordId);
    } catch (err) { alert("Помилка видалення"); }
}

const originalFetch = window.fetch;
window.fetch = async function(resource, config = {}) {
    const token = localStorage.getItem('jwt_token');
    if(!token) { window.location.href = '/'; return; }
    
    if (typeof resource === 'string' && (resource.includes('/api/') || resource.includes('/upload')) && !resource.includes('/auth/')) {
        config.headers = config.headers || {};
        if (!(config.body instanceof FormData)) { config.headers['Content-Type'] = config.headers['Content-Type'] || 'application/json'; }
        
        if (config.headers instanceof Headers) { config.headers.set('Authorization', `Bearer ${token}`); } 
        else { config.headers['Authorization'] = `Bearer ${token}`; }
    }
    
    const response = await originalFetch(resource, config);
    if(response.status === 401 && typeof resource === 'string' && !resource.includes('/auth/')) {
        localStorage.removeItem('jwt_token');
        window.location.href = '/';
    }
    return response;
};

function logout() {
    localStorage.removeItem('jwt_token');
    window.location.href = '/';
}

// Завантажуємо таблицю при старті
loadTable();