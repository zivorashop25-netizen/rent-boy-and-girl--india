document.addEventListener("DOMContentLoaded", () => {
  loadPaymentInfo();
  loadProfiles();
  loadMyAccount();
  loadMyBookings();
  setupBookingDate();
});


/* =========================
   MOBILE MENU
========================= */

function toggleMenu() {
  const menu = document.getElementById("navMenu");

  if (menu) {
    menu.classList.toggle("active");
  }
}


/* =========================
   HELPER
========================= */

function showMessage(id, message, type = "") {
  const element = document.getElementById(id);

  if (!element) return;

  element.textContent = message;
  element.className = "message";

  if (type) {
    element.classList.add(type);
  }
}


/* =========================
   REGISTER
========================= */

const registerForm = document.getElementById("registerForm");

if (registerForm) {
  registerForm.addEventListener("submit", registerUser);
}


async function registerUser(event) {
  event.preventDefault();

  const name = document.getElementById("registerName").value.trim();
  const phone = document.getElementById("registerPhone").value.trim();
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value;
  const age = Number(document.getElementById("registerAge").value);
  const city = document.getElementById("registerCity").value.trim();
  const gender = document.getElementById("registerGender").value;

  if (age < 18) {
    showMessage(
      "registerMessage",
      "Only 18+ adults can register.",
      "error"
    );
    return;
  }

  showMessage(
    "registerMessage",
    "Creating your account..."
  );

  try {
    const response = await fetch("/api/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name,
        phone,
        email,
        password,
        age,
        city,
        gender
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      showMessage(
        "registerMessage",
        data.message || "Registration failed.",
        "error"
      );
      return;
    }

    showMessage(
      "registerMessage",
      "Account created. Please complete the ₹499 payment.",
      "success"
    );

    const paymentSection = document.getElementById("payment");

    if (paymentSection) {
      paymentSection.classList.remove("hidden");
      paymentSection.scrollIntoView({
        behavior: "smooth"
      });
    }

    await loadPaymentInfo();

  } catch (error) {
    console.error(error);

    showMessage(
      "registerMessage",
      "Server error. Please try again.",
      "error"
    );
  }
}


/* =========================
   PAYMENT INFORMATION
========================= */

async function loadPaymentInfo() {
  try {
    const response = await fetch("/api/payment-info");
    const data = await response.json();

    if (!data.success) return;

    const upiElement = document.getElementById("upiId");
    const qrElement = document.getElementById("paymentQR");

    if (upiElement) {
      upiElement.textContent = data.upiId;
    }

    if (qrElement && data.qr) {
      qrElement.src = data.qr;
    }

  } catch (error) {
    console.error("Payment info error:", error);
  }
}


/* =========================
   PAYMENT / UTR
========================= */

const paymentForm = document.getElementById("paymentForm");

if (paymentForm) {
  paymentForm.addEventListener("submit", submitPayment);
}


async function submitPayment(event) {
  event.preventDefault();

  const utrInput = document.getElementById("utr");

  if (!utrInput) return;

  const utr = utrInput.value.trim();

  if (!utr) {
    showMessage(
      "paymentMessage",
      "Please enter your UTR number.",
      "error"
    );
    return;
  }

  showMessage(
    "paymentMessage",
    "Submitting UTR..."
  );

  try {
    const response = await fetch("/api/payment/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        utr
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      showMessage(
        "paymentMessage",
        data.message || "UTR submission failed.",
        "error"
      );
      return;
    }

    showMessage(
      "paymentMessage",
      "UTR submitted successfully. Please wait for admin approval.",
      "success"
    );

    utrInput.value = "";

    await loadPaymentStatus();
    await loadMyAccount();

  } catch (error) {
    console.error(error);

    showMessage(
      "paymentMessage",
      "Payment submission failed.",
      "error"
    );
  }
}


/* =========================
   PAYMENT STATUS
========================= */

async function loadPaymentStatus() {
  try {
    const response = await fetch("/api/payment/status");

    if (!response.ok) return;

    const data = await response.json();

    if (!data.success) return;

    const message = document.getElementById("paymentMessage");

    if (!message) return;

    if (data.status === "approved") {
      showMessage(
        "paymentMessage",
        "Payment approved. Your account is active.",
        "success"
      );
    }

    if (data.status === "pending") {
      showMessage(
        "paymentMessage",
        "Payment is pending admin approval."
      );
    }

    if (data.status === "rejected") {
      showMessage(
        "paymentMessage",
        "Payment was rejected. Please contact support.",
        "error"
      );
    }

  } catch (error) {
    console.error("Payment status error:", error);
  }
}


/* =========================
   LOGIN
========================= */

const loginForm = document.getElementById("loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", loginUser);
}


async function loginUser(event) {
  event.preventDefault();

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  showMessage(
    "loginMessage",
    "Logging in..."
  );

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        password
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      showMessage(
        "loginMessage",
        data.message || "Login failed.",
        "error"
      );
      return;
    }

    showMessage(
      "loginMessage",
      "Login successful.",
      "success"
    );

    await loadMyAccount();
    await loadMyBookings();

    document.getElementById("account")?.scrollIntoView({
      behavior: "smooth"
    });

  } catch (error) {
    console.error(error);

    showMessage(
      "loginMessage",
      "Server error. Please try again.",
      "error"
    );
  }
}


/* =========================
   LOGOUT
========================= */

async function logoutUser() {
  try {
    await fetch("/api/logout", {
      method: "POST"
    });

    await loadMyAccount();
    await loadMyBookings();

    alert("You have been logged out.");

  } catch (error) {
    console.error(error);
  }
}


/* =========================
   MY ACCOUNT
========================= */

async function loadMyAccount() {
  const account = document.getElementById("myAccount");

  if (!account) return;

  try {
    const response = await fetch("/api/me");

    if (!response.ok) {
      account.innerHTML = `
        <p>Please login to view your account.</p>
      `;
      return;
    }

    const data = await response.json();

    if (!data.success || !data.user) {
      account.innerHTML = `
        <p>Please login to view your account.</p>
      `;
      return;
    }

    const user = data.user;

    const status = user.verified
      ? "Verified / Active"
      : "Pending Approval";

    account.innerHTML = `
      <div class="account-info">

        <h3>${escapeHTML(user.name || "")}</h3>

        <p>
          <b>Email:</b>
          ${escapeHTML(user.email || "")}
        </p>

        <p>
          <b>Phone:</b>
          ${escapeHTML(user.phone || "")}
        </p>

        <p>
          <b>Age:</b>
          ${escapeHTML(String(user.age || ""))}
        </p>

        <p>
          <b>City:</b>
          ${escapeHTML(user.city || "")}
        </p>

        <p>
          <b>Gender:</b>
          ${escapeHTML(user.gender || "")}
        </p>

        <p>
          <b>Status:</b>
          ${status}
        </p>

        <button
          type="button"
          class="btn secondary"
          onclick="logoutUser()"
        >
          Logout
        </button>

      </div>
    `;

  } catch (error) {
    console.error("Account error:", error);

    account.innerHTML = `
      <p>Unable to load account.</p>
    `;
  }
}


/* =========================
   PROFILES
========================= */

async function loadProfiles() {
  const container =
    document.getElementById("profilesList");

  if (!container) return;

  const city =
    document.getElementById("searchCity")?.value.trim() || "";

  const gender =
    document.getElementById("searchGender")?.value || "";

  container.innerHTML = `
    <p>Loading profiles...</p>
  `;

  try {
    let url = "/api/profiles";

    const params = new URLSearchParams();

    if (city) {
      params.append("city", city);
    }

    if (gender) {
      params.append("gender", gender);
    }

    if (params.toString()) {
      url += "?" + params.toString();
    }

    const response = await fetch(url);
    const data = await response.json();

    if (!data.success) {
      container.innerHTML = `
        <p>No profiles available.</p>
      `;
      return;
    }

    const profiles = data.profiles || [];

    if (profiles.length === 0) {
      container.innerHTML = `
        <p>No verified profiles found.</p>
      `;

      updateBookingProfiles([]);
      return;
    }

    container.innerHTML = profiles.map(profile => {

      const safeName =
        escapeHTML(profile.name || "User");

      const safeCity =
        escapeHTML(profile.city || "");

      const safeGender =
        escapeHTML(profile.gender || "");

      const age =
        escapeHTML(String(profile.age || ""));

      return `
        <div class="profile-card">

          <div class="profile-photo">
            ${
              profile.photo_url
                ? `<img
                    src="${escapeAttribute(profile.photo_url)}"
                    alt="${safeName}"
                  >`
                : `<div class="profile-placeholder">
                    👤
                  </div>`
            }
          </div>

          <h3>
            ${safeName}
          </h3>

          <p>
            ${age} years • ${safeGender}
          </p>

          <p>
            📍 ${safeCity}
          </p>

          <button
            type="button"
            class="btn primary"
            onclick="selectProfileForBooking('${escapeAttribute(profile.id || profile._id || "")}')"
          >
            Book Now
          </button>

        </div>
      `;
    }).join("");

    updateBookingProfiles(profiles);

  } catch (error) {
    console.error("Profiles error:", error);

    container.innerHTML = `
      <p>Unable to load profiles.</p>
    `;
  }
}


/* =========================
   BOOKING PROFILE DROPDOWN
========================= */

function updateBookingProfiles(profiles) {
  const select =
    document.getElementById("bookingProfile");

  if (!select) return;

  select.innerHTML = `
    <option value="">
      Select a profile
    </option>
  `;

  profiles.forEach(profile => {

    const option =
      document.createElement("option");

    option.value =
      profile.id || profile._id || "";

    option.textContent =
      `${profile.name || "User"} - ${profile.city || ""}`;

    select.appendChild(option);
  });
}


/* =========================
   SELECT PROFILE FOR BOOKING
========================= */

function selectProfileForBooking(profileId) {

  const select =
    document.getElementById("bookingProfile");

  if (select) {
    select.value = profileId;
  }

  const booking =
    document.getElementById("booking");

  if (booking) {
    booking.scrollIntoView({
      behavior: "smooth"
    });
  }
}


/* =========================
   BOOKING DATE
========================= */

function setupBookingDate() {

  const dateInput =
    document.getElementById("bookingDate");

  if (!dateInput) return;

  const today =
    new Date().toISOString().split("T")[0];

  dateInput.min = today;
}


/* =========================
   CREATE BOOKING
========================= */

const bookingForm =
  document.getElementById("bookingForm");

if (bookingForm) {
  bookingForm.addEventListener(
    "submit",
    createBooking
  );
}


async function createBooking(event) {

  event.preventDefault();

  const profileId =
    document.getElementById("bookingProfile")?.value;

  const category =
    document.getElementById("bookingCategory")?.value;

  const date =
    document.getElementById("bookingDate")?.value;

  const time =
    document.getElementById("bookingTime")?.value;

  const duration =
    document.getElementById("bookingDuration")?.value;

  const location =
    document.getElementById("bookingLocation")?.value.trim();

  const notes =
    document.getElementById("bookingNotes")?.value.trim();

  if (!profileId) {
    showMessage(
      "bookingMessage",
      "Please select a profile.",
      "error"
    );
    return;
  }

  if (!category || !date || !time || !duration || !location) {
    showMessage(
      "bookingMessage",
      "Please fill all required booking details.",
      "error"
    );
    return;
  }

  showMessage(
    "bookingMessage",
    "Sending booking request..."
  );

  try {

    const response =
      await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          profileId,
          category,
          date,
          time,
          duration,
          location,
          notes
        })
      });

    const data =
      await response.json();

    if (!response.ok || !data.success) {

      showMessage(
        "bookingMessage",
        data.message || "Booking request failed.",
        "error"
      );

      return;
    }

    showMessage(
      "bookingMessage",
      "Booking request sent successfully.",
      "success"
    );

    bookingForm.reset();

    setupBookingDate();

    await loadMyBookings();

    document
      .getElementById("myBookings")
      ?.scrollIntoView({
        behavior: "smooth"
      });

  } catch (error) {

    console.error("Booking error:", error);

    showMessage(
      "bookingMessage",
      "Booking server is not ready yet. Please try again.",
      "error"
    );
  }
}


/* =========================
   MY BOOKINGS
========================= */

async function loadMyBookings() {

  const container =
    document.getElementById("bookingsList");

  if (!container) return;

  try {

    const response =
      await fetch("/api/bookings/my");

    if (!response.ok) {

      container.innerHTML = `
        <p>
          Please login to view your bookings.
        </p>
      `;

      return;
    }

    const data =
      await response.json();

    if (!data.success) {

      container.innerHTML = `
        <p>
          Please login to view your bookings.
        </p>
      `;

      return;
    }

    const bookings =
      data.bookings || [];

    if (bookings.length === 0) {

      container.innerHTML = `
        <p>
          You have no bookings yet.
        </p>
      `;

      return;
    }

    container.innerHTML =
      bookings.map(booking => {

        const status =
          String(
            booking.status || "pending"
          ).toLowerCase();

        return `
          <div class="booking-card">

            <h3>
              ${escapeHTML(
                booking.category || "Booking"
              )}
            </h3>

            <p>
              <b>Date:</b>
              ${escapeHTML(
                booking.date || ""
              )}
            </p>

            <p>
              <b>Time:</b>
              ${escapeHTML(
                booking.time || ""
              )}
            </p>

            <p>
              <b>Duration:</b>
              ${escapeHTML(
                booking.duration || ""
              )}
            </p>

            <p>
              <b>Location:</b>
              ${escapeHTML(
                booking.location || ""
              )}
            </p>

            <p>
              <b>Status:</b>
              ${escapeHTML(status)}
            </p>

          </div>
        `;

      }).join("");

  } catch (error) {

    console.error("My bookings error:", error);

    container.innerHTML = `
      <p>
        Unable to load bookings.
      </p>
    `;
  }
}


/* =========================
   HTML SECURITY
========================= */

function escapeHTML(value) {

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function escapeAttribute(value) {

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
