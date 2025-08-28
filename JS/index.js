// Кнопка імпорту таблиці в форматі .xlsx, .csv, .xls
const fileInput = document.getElementById("container__file-input");
const importButton = document.getElementById("container__file-import");
const tableBody = document.querySelector("#meta__table tbody");

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

  if (fileInput.files && fileInput.files.length > 0) {
    window.location.reload();
  }
});

// Завантаження таблиць з бекенду
async function loadTables(page, limit = 10) {
  const res = await fetch(`/api/meta_tables?page=${page}&limit=${limit}`);
  if (!res.ok) {
    console.error("Failed to load meta_tables:", res.status, await res.text());
    return;
  }

  const payload = await res.json();
  // payload may be { data: [...], totalPages, page, total }
  const rows = Array.isArray(payload) ? payload : payload.data || [];
  const totalPages = payload.totalPages || 1;

  tableBody.innerHTML = "";
  rows.forEach((row) => {
    const id = row.id ?? row.tableName ?? row.name ?? "";
    const tr = document.createElement("tr");
    tr.innerHTML = `
        <td>${row.id ?? ""}</td>
        <td>${row.name ?? ""}</td>
        <td>${row.faculty ?? ""}</td>
        <td>${row.speciality_code ?? ""}</td>
        <td>${row.created_at ?? ""}</td>
        <td>${row.updated_at ?? ""}</td>
        <td>
          <button class="btn btn-sm btn-outline-warning" onclick="editTable('${id}')"><img src="../images/edit-icon.png" width="25" heigth="35" style= "padding: 1px;" /></button>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteTable('${id}')"><img src="../images/delete-icon.png" width="25" heigth="35"style= "padding: 1px;" /></button>
        </td>
      `;
    // Додаємо стилі курсора та обробник кліку
    tr.style.cursor = "pointer";
    tr.addEventListener("click", (e) => {
      // Не реагувати, якщо клік по кнопці редагування/видалення
      if (
        e.target.closest("button") ||
        e.target.tagName === "BUTTON" ||
        e.target.closest("img")
      )
        return;
      openTable(row.tableName || row.name || row.id);
    });
    tableBody.appendChild(tr);
  });

  renderPagination(totalPages, page);
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

// Редагування метаданих таблиці
async function editTable(id) {
  // Отримати метадані таблиці
  const res = await fetch(`/api/meta_tables/${id}`);
  if (!res.ok) {
    alert("Не вдалося завантажити дані таблиці");
    return;
  }
  const row = await res.json();

  const form = document.querySelector("#tableModal form");
  form.dataset.editId = id;

  // Заповнити поля форми
  document.getElementById("form__table-name").value = row.tableName || "";
  document.getElementById("form__faculty-name").value = row.faculty || "";
  document.getElementById("form__specialty-code").value =
    row.speciality_code || "";
  document.getElementById("form__department-name").value = row.department || "";
  document.getElementById("form__group-count").value = row.groups_count || "";
  document.getElementById("form__entry-year").value = row.entry_year || "";

  new bootstrap.Modal(document.querySelector("#tableModal")).show();
}

// Видалення таблиці
async function deleteTable(id) {
  if (!confirm("Ви впевнені, що хочете видалити цю таблицю?")) return;

  const res = await fetch(`/api/meta_tables/${id}`, { method: "DELETE" });
  if (res.ok) {
    await loadTables(1);
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
    const department = document
      .getElementById("form__department-name")
      .value.trim();
    const groups_count =
      parseInt(document.getElementById("form__group-count").value, 10) || 0;
    const entry_year =
      parseInt(document.getElementById("form__entry-year").value, 10) ||
      new Date().getFullYear();

    if (!tableName) {
      alert("Введіть назву таблиці");
      return;
    }

    // Якщо є editId - редагування, інакше створення
    const editId = tableForm.dataset.editId;
    const url = editId ? `/api/meta_tables/${editId}` : "/create-table";
    const method = editId ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableName,
          faculty,
          speciality_code,
          department,
          groups_count,
          entry_year,
        }),
      });
      if (res.ok) {
        location.reload();
      } else {
        const err = await res.json();
        alert(
          err.error ||
            (editId ? "Помилка оновлення таблиці" : "Помилка створення таблиці")
        );
      }
    } catch (err) {
      alert("Помилка з'єднання з сервером");
    }
  });
}

async function openTable(tableName) {
  if (!tableName) return;
  // Наприклад, перехід на сторінку перегляду таблиці:
  try {
    window.location.href = `/table?tableName=${encodeURIComponent(tableName)}`;
    const res = await fetch(`/api/table?tableName=${tableName}`);
    
  } catch (error) {
    console.error(error);
  }
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
