
// Завантаження таблиць з бекенду
async function loadTables(page) {
  const res = await fetch(`/api/tables?page=${page}`);
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
        <button class="btn btn-sm btn-warning" onclick="editTable(${row.id})">✏️</button>
        <button class="btn btn-sm btn-danger" onclick="deleteTable(${row.id})">🗑️</button>
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
