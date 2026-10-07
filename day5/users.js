// Select elements
const loadButton = document.getElementById("load-users");
const filterInput = document.getElementById("filter-input");
const statusMessage = document.getElementById("status");
const usersList = document.getElementById("users-list");

const API_URL = "https://jsonplaceholder.typicode.com/users";

// All users from the server are stored here, so filtering needs no new request
let allUsers = [];

// Fetch the users from the API
async function loadUsers() {
  statusMessage.textContent = "Loading users...";
  loadButton.disabled = true;

  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error(`The server replied with status ${response.status}.`);
    }

    allUsers = await response.json();
    renderUsers(allUsers);
    statusMessage.textContent = `Loaded ${allUsers.length} users successfully.`;
  } catch (error) {
    statusMessage.textContent = `Error: could not load users. ${error.message}`;
  } finally {
    loadButton.disabled = false;
  }
}

// Draw any array of users in the list
function renderUsers(list) {
  usersList.textContent = "";

  for (const user of list) {
    const item = document.createElement("li");

    const name = document.createElement("strong");
    name.textContent = user.name;

    const email = document.createElement("p");
    email.textContent = `Email: ${user.email}`;

    const city = document.createElement("p");
    city.textContent = `City: ${user.address.city}`;

    const company = document.createElement("p");
    company.textContent = `Company: ${user.company.name}`;

    item.append(name, email, city, company);
    usersList.appendChild(item);
  }
}

// Filter the stored users as the person types (no new request)
filterInput.addEventListener("input", function () {
  if (allUsers.length === 0) {
    return;
  }

  const filterText = filterInput.value.trim().toLowerCase();
  const matches = allUsers.filter(function (user) {
    return user.name.toLowerCase().includes(filterText);
  });

  renderUsers(matches);

  if (matches.length === 0) {
    statusMessage.textContent = "No users match your filter.";
  } else {
    statusMessage.textContent = `Showing ${matches.length} of ${allUsers.length} users.`;
  }
});

loadButton.addEventListener("click", loadUsers);
