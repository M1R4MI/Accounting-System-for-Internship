const API_URL = "localhost:3308";

// Кнопка імпорту таблиці в форматі .xlsx, .csv, .xls
const fileInput = document.getElementById("container__file-input");
const importButton = document.getElementById("container__file-import");

// відкриваємо системну форму вибору файлу з системи
importButton.addEventListener("click", () => {
  fileInput.click();
});

// Після завантаження файлу перезавантажуємо сторінку
fileInput.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (file) {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      alert(data.message);
    } catch (err) {
      console.error(err);
    }
  }

  if (fileInput.isDefaultNamespace.length > 0) {
    window.location.reload();
  }
});

// Завантаження таблиць з бекенду
async function loadTables(page, limit = 10) {
  const res = await fetch(`/api/tables?page=${page}&limit=${limit}`);
  const data = await res.json();

  const tbody = document.querySelector("table tbody");
  tbody.innerHTML = "";

  data.rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.name}</td>
      <td>${row.faculty}</td>
      <td>${row.speciality_code}</td>
      <td>${row.created_at}</td>
      <td>${row.updated_at}</td>
      <td>
        <button class="btn btn-sm btn-warning" onclick="editTable(${row.id})"><img src="../public/images/edit-icon.png" /></button>
        <button class="btn btn-sm btn-danger" onclick="deleteTable(${row.id})"><img src="../public/images/delete-icon.png" /></button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  renderPagination(data.totalPages, page);
}

// Створення пагінації
function renderPagination(totalPages, currentPage) {
  const pagination = document.querySelector(".pagination");
  pagination.innerHTML = "";

  for (let i = 1; i <= totalPages; i++) {
    const li = document.createElement("li");
    li.className = `page-item ${i === currentPage ? "active" : ""}`;
    li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
    li.addEventListener("click", () => loadTables(i));
    pagination.appendChild(li);
  }

  localStorage.setItem("currentPage", currentPage);
}

// Редагування таблиці
async function editTable(id) {
  const res = await fetch(`/api/tables/${id}`);
  const row = await res.json();

  const form = document.querySelector("#tableModal form");
  form.dataset.editId = id;

  form.querySelectorAll("input").forEach((input) => {
    input.value = row[input.name] || "";
  });

  new bootstrap.Modal(document.querySelector("#tableModal")).show();
}

// Видалення таблиці
async function deleteTable(id) {
  if (!confirm("Ви впевнені, що хочете видалити цю таблицю?")) return;

  const res = await fetch(`/api/tables/${id}`, { method: "DELETE" });
  if (res.ok) {
    loadTables(1);
  } else {
    alert("Помилка видалення!");
  }
}

// Обробник створення нової таблиці з модального вікна
const tableForm = document.querySelector("#tableModal form");

// Коли відкриваємо модалку для додавання - очищаємо форму
const addButton = document.querySelector(".btn-add");
if (addButton) {
  addButton.addEventListener("click", () => {
    if (tableForm) {
      tableForm.reset();
      delete tableForm.dataset.editId;
    }
  });
}

if (tableForm) {
  tableForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const tableName = document.getElementById("form__table-name").value.trim();
    const faculty = document.getElementById("form__faculty-name").value.trim();
    const speciality_code = document
      .getElementById("form__specialty-code")
      .value.trim();
    const department = document.getElementById("form__department-name").value.trim();
    const groups_count = parseInt(document.getElementById("form__group-count").value, 10) || 0;
    const entry_year = parseInt(document.getElementById("form__entry-year").value, 10) || new Date().getFullYear();

    if (!tableName) {
      alert("Введіть назву таблиці");
      return;
    }

    try {
      const res = await fetch('/create-table', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableName, faculty, speciality_code, department, groups_count, entry_year })
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || data.message || 'Помилка при створенні таблиці');
        return;
      }

      // Закрити модал і перезавантажити список таблиць
      const modalEl = document.querySelector('#tableModal');
      const bsModal = bootstrap.Modal.getInstance(modalEl);
      if (bsModal) bsModal.hide();

      const savePage = localStorage.getItem('currentPage');
      loadTables(savePage ? parseInt(savePage) : 1, 10);
      alert(data.message || 'Таблиця створена');
    } catch (err) {
      console.error(err);
      alert('Помилка при створенні таблиці');
    }
  });
}

// load page from local storage after page reload
window.addEventListener("load", () => {
  const savePage = localStorage.getItem("currentPage");
  loadTables(savePage ? parseInt(savePage) : 1, 10);
});

//delete page data from local storage before page is closed
window.addEventListener("beforeunload", () => {
  localStorage.removeItem("currentPage");
});