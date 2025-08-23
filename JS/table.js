const API_URL = "http://localhost:3308/table";
const tableBody = document.querySelector("#dataTable tbody");
const form = document.querySelector("#addForm");
const formTitle = document.getElementById("formHead");
let sortOrder = "asc";
const rowsPerPage = 20;

function table(data) {
  tableBody.innerHTML = "";
  data.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
            <td>${row.ID}</td>
            <td>${row.registrationNumber}</td>
            <td>${row.registrationDate || ""}</td>
            <td>${row.name}</td>
            <td>${row.studentGroup || ""}</td>
            <td>${row.information || ""}</td>
            <td>${row.contact || ""}</td>
            <td>${row.documentType || ""}</td>
            <td>${row.signingStatus || ""}</td>
            <td>${row.op || ""}</td>
            <td style="align-items: center;">
                <button onclick="editRow(${JSON.stringify(
                  row
                ).replace(/"/g, "&quot;")})">
                    <img src="../images/edit_icon.png" width="25" heigth="35">
                </button>
                <button onclick="deleteRow(${row.ID})">
                    <img src="../images/delete_icon.png" width="25" height="25">
                </button>
                <button onclick="cloneRow(${row.ID})">
                    <img src="../images/duplicate.png" width="25" height="25">
                </button>
            </td>
        `;
    tableBody.appendChild(tr);
  });
}

async function loadTable() {
  try {
    const res = await fetch(API_URL);
    const data = await res.json();
    table(data);
  } catch (err) {
    console.error("Failed to load table: ", err);
  }
}

function editRow(row) {
  document.getElementById("editFormDiv").style.display = "block";
  document.getElementById("editId").value = row.ID;
  document.getElementById("editRegistrationNumber").value =
    row.registrationNumber;
  document.getElementById("editNameField").value = row.name;
  document.getElementById("editGroup").value = row.studentGroup;
  document.getElementById("editRegistrationDate").value = row.registrationDate;
  document.getElementById("editInformation").value = row.information;
  document.getElementById("editContact").value = row.contact;
  document.getElementById("editSigningStatus").value = row.signingStatus;
  document.getElementById("editDocumentType").value = row.documentType;
  document.getElementById("editop").value = row.op;
}

async function deleteRow(id) {
  if (confirm("Ви дійсно хочете видалити цей рядок?")) {
    try {
      await fetch(`${API_URL}/${id}`, { method: "DELETE" });
      await loadTable();
    } catch (err) {
      console.error("Failed to delete row: ", err);
    }
  }
}

async function cloneRow(id) {
  try {
    await fetch(`${API_URL}/clone/${id}`, {
      method: "POST",
      headers: { "Content-Type": "/application/json" },
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
    if (input != "") {
      const res = await fetch(`${API_URL}/search/${encodeURIComponent(input)}`);
      const data = await res.json();
      if (data != "") {
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
    const res = await fetch(`${API_URL}/sort?by=${column}&order=${order}`);
    const data = await res.json();
    if (data != "") {
      table(data);
    } else {
      loadtable();
    }
  } catch (err) {
    console.error(err);
  }
}

function sortBy(column) {
  //sortOrder = (sortOrder === 'desc') ? 'asc' : 'desc'; // Toggle order
  performSearch(column, sortOrder);
  document.getElementById("filterFormDiv").style.display = "none";
}

//Export function with redirection to the server
async function exportTable(tableName) {
  try {
    const res = await fetch(`${API_URL}/export?table=${tableName}`, {
      method: "GET",
    });

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
document.getElementById("editForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = document.getElementById("editId").value;
  const data = {
    name: document.getElementById("editNameField").value,
    registrationDate: document.getElementById("editRegistrationDate").value,
    information: document.getElementById("editInformation").value,
    contact: document.getElementById("editContact").value,
    studentGroup: document.getElementById("editGroup").value,
    documentType: document.getElementById("editDocumentType").value,
    signingStatus: document.getElementById("editSigningStatus").value,
    op: document.getElementById("editop").value,
  };

  try {
    const res = await fetch(`${API_URL}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    await res.json();
    await loadTable();
    closeEditForm();
  } catch (err) {
    console.error("Error: ", err);
    console.log("Update failed!");
  }
});

//--Event listener for add form--
document.getElementById("addForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("id").value;
  const data = {
    name: document.getElementById("nameField").value,
    registrationNumber: document.getElementById("registrationNumber").value,
    registrationDate: document.getElementById("registrationDate").value,
    information: document.getElementById("information").value,
    contact: document.getElementById("contact").value,
    studentGroup: document.getElementById("group").value,
    documentType: document.getElementById("documentType").value,
    signingStatus: document.getElementById("signingStatus").value,
    op: document.getElementById("op").value,
  };

  try {
    await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    form.reset();
    document.getElementById("id").value = "";
    await loadTable();
  } catch (err) {
    console.error("Failed to add row: ", err);
  }
});

loadTable();
