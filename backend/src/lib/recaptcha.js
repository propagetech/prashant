export async function verifyRecaptcha(token) {
  const secret = process.env.RECAPTCHA_SECRET || "";
  if (!secret) {
    return true;
  }
  if (!token) {
    return false;
  }
  try {
    const body = new URLSearchParams({ secret, response: token });
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const json = await res.json();
    return Boolean(json.success);
  } catch (err) {
    console.warn("reCAPTCHA verify failed open", err);
    return true;
  }
}
