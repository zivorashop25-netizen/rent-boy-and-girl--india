document.addEventListener("DOMContentLoaded", () => {
  loadProfiles();
  loadMyAccount();
  loadPaymentInfo();

  const registerForm = document.getElementById("registerForm");
  const loginForm = document.getElementById("loginForm");
  const paymentForm = document.getElementById("paymentForm");

  if (registerForm) {
    registerForm.addEventListener("submit", registerUser);
  }

  if (loginForm) {
    loginForm.addEventListener("submit", loginUser);
  }

  if (paymentForm) {
    paymentForm.addEventListener("submit", submitPayment);
  }
});


/* =========================
   MOBILE MENU
========================= */

function toggleMenu() {
  const nav = document.getElementById("navMenu");

  if (nav) {
    nav.classList.toggle("show");
  }
}


/* =========================
   REGISTER
========================= */

async function registerUser(event) {
  event.preventDefault();

  const message = document.getElementById("registerMessage");

  const name = document.getElementById("registerName").value.trim();
  const phone = document.getElementById("registerPhone").value.trim();
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value;
  const age = Number(document.getElementById("registerAge").value);
  const city = document.getElementById("registerCity").value.trim();
  const gender = document.getElementById("registerGender").value;

  if (age < 18) {
    message.textContent = "Only 18+ adults can register.";
    return;
  }

  message.textContent = "Creating your account...";

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
      message.textContent =
        data.message || "Registration failed.";
      return;
    }

    message.textContent =
      "Account created. Please complete the ₹499 payment.";

    document.getElementById("payment").classList.remove("hidden");

    setTimeout(() => {
      document.getElementById("payment")
        .scrollIntoView({
          behavior: "smooth"
        });
    }, 300);

    await loadPaymentInfo();
    await loadMyAccount();

  } catch (error) {
    console.error(error);

    message.textContent =
      "Server error. Please try again.";
  }
}


/* =========================
   LOGIN
========================= */

async function loginUser(event) {
  event.preventDefault();

  const message = document.getElementById("loginMessage");

  const email =
    document.getElementById("loginEmail").value.trim();

  const password =
    document.getElementById("loginPassword").value;

  message.textContent = "Logging in...";

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
      message.textContent =
        data.message || "Login failed.";
      return;
    }

    message.textContent = "Login successful.";

    await loadMyAccount();
    await loadPaymentStatus();

  } catch (error) {
    console.error(error);

    message.textContent =
      "Server error. Please try again.";
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

    document.getElementById("myAccount").innerHTML = `
      <p>You have been logged out.</p>
    `;

    document.getElementById("payment")
      .classList.add("hidden");

  } catch (error) {

    console.error(error);

  }
}


/* =========================
   PAYMENT INFO
========================= */

async function loadPaymentInfo() {

  try {

    const response =
      await fetch("/api/payment-info");

    const data =
      await response.json();

    if (!data.success) {
      return;
    }

    const upiId =
      document.getElementById("upiId");

    const qr =
      document.getElementById("paymentQR");

    if (upiId) {
      upiId.textContent =
        data.upiId || "8822627454-3@ybl";
    }

    if (qr && data.qr) {
      qr.src = data.qr;
    }

  } catch (error) {

    console.error(
      "Payment info error:",
      error
    );

  }
}


/* =========================
   SHOW PAYMENT
========================= */

function showPaymentSection() {

  const payment =
    document.getElementById("payment");

  if (!payment) {
    return;
  }

  payment.classList.remove("hidden");

  payment.scrollIntoView({
    behavior: "smooth"
  });

  loadPaymentInfo();
}


/* =========================
   SUBMIT UTR
========================= */

async function submitPayment(event) {

  event.preventDefault();

  const message =
    document.getElementById("paymentMessage");

  const utr =
    document.getElementById("utr").value.trim();

  if (!utr) {

    message.textContent =
      "Please enter your UTR number.";

    return;
  }

  message.textContent =
    "Submitting payment details...";

  try {

    const response =
      await fetch("/api/payment/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          utr
        })
      });

    const data =
      await response.json();

    if (!response.ok || !data.success) {

      message.textContent =
        data.message ||
        "Payment submission failed.";

      return;
    }

    message.textContent =
      "UTR submitted successfully. Your payment is pending admin approval.";

    document.getElementById("utr").value = "";

    await loadMyAccount();
    await loadPaymentStatus();

  } catch (error) {

    console.error(error);

    message.textContent =
      "Server error. Please try again.";

  }
}


/* =========================
   PAYMENT STATUS
========================= */

async function loadPaymentStatus() {

  try {

    const response =
      await fetch("/api/payment/status");

    if (response.status === 401) {
      return;
    }

    const data =
      await response.json();

    if (!data.success) {
      return;
    }

    const payment =
      document.getElementById("payment");

    if (!payment) {
      return;
    }

    if (
      data.status === "pending" ||
      data.status === "rejected"
    ) {

      payment.classList.remove("hidden");

    }

    if (data.status === "approved") {

      payment.classList.add("hidden");

    }

  } catch (error) {

    console.error(
      "Payment status error:",
      error
    );

  }
}


/* =========================
   MY ACCOUNT
========================= */

async function loadMyAccount() {

  const box =
    document.getElementById("myAccount");

  if (!box) {
    return;
  }

  try {

    const response =
      await fetch("/api/me");

    if (response.status === 401) {

      box.innerHTML = `
        <p>Please login to view your account.</p>
      `;

      return;
    }

    const data =
      await response.json();

    if (!data.success || !data.user) {

      box.innerHTML = `
        <p>Please login to view your account.</p>
      `;

      return;
    }

    const user = data.user;

    let statusText =
      "Payment pending";

    if (user.verified === 1) {
      statusText =
        "Account verified and active";
    }

    box.innerHTML = `
      <div class="account-info">

        <h3>${escapeHtml(user.name)}</h3>

        <p>
          <b>Email:</b>
          ${escapeHtml(user.email)}
        </p>

        <p>
          <b>Phone:</b>
          ${escapeHtml(user.phone || "")}
        </p>

        <p>
          <b>Age:</b>
          ${escapeHtml(String(user.age || ""))}
        </p>

        <p>
          <b>City:</b>
          ${escapeHtml(user.city || "")}
        </p>

        <p>
          <b>Gender:</b>
          ${escapeHtml(user.gender || "")}
        </p>

        <p>
          <b>Status:</b>
          ${statusText}
        </p>

        <button
          class="btn secondary"
          onclick="logoutUser()"
        >
          Logout
        </button>

      </div>
    `;

    if (user.verified !== 1) {

      showPaymentSection();

    } else {

      document
        .getElementById("payment")
        .classList.add("hidden");

    }

  } catch (error) {

    console.error(
      "Account error:",
      error
    );

  }
}


/* =========================
   PROFILES
========================= */

async function loadProfiles() {

  const container =
    document.getElementById("profiles");

  if (!container) {
    return;
  }

  const cityInput =
    document.getElementById("searchCity");

  const genderInput =
    document.getElementById("searchGender");

  const city =
    cityInput
      ? cityInput.value.trim()
      : "";

  const gender =
    genderInput
      ? genderInput.value
      : "";

  container.innerHTML =
    "<p>Loading profiles...</p>";

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

    const response =
      await fetch(url);

    const data =
      await response.json();

    if (!data.success) {

      container.innerHTML =
        "<p>Unable to load profiles.</p>";

      return;
    }

    if (!data.profiles || data.profiles.length === 0) {

      container.innerHTML = `
        <p>
          No verified profiles found.
        </p>
      `;

      return;
    }

    container.innerHTML =
      data.profiles
        .map(profile => {

          const photo =
            profile.photo_url ||
            "https://via.placeholder.com/500x400?text=Profile";

          return `
            <div class="profile-card">

              <img
                src="${escapeAttribute(photo)}"
                alt="Profile photo"
                onerror="this.src='https://via.placeholder.com/500x400?text=Profile'"
              >

              <h3>
                ${escapeHtml(profile.name)}
              </h3>

              <p>
                Age: ${escapeHtml(String(profile.age || ""))}
              </p>

              <p>
                City: ${escapeHtml(profile.city || "")}
              </p>

              <p>
                Gender: ${escapeHtml(profile.gender || "")}
              </p>

              ${
                profile.bio
                  ? `<p>${escapeHtml(profile.bio)}</p>`
                  : ""
              }

            </div>
          `;

        })
        .join("");

  } catch (error) {

    console.error(
      "Profiles error:",
      error
    );

    container.innerHTML =
      "<p>Server error while loading profiles.</p>";

  }
}


/* =========================
   HTML SAFETY
========================= */

function escapeHtml(value) {

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


function escapeAttribute(value) {

  return String(value)
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

        }
