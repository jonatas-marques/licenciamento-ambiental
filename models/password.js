import bcryptjs from "bcryptjs";

async function hash(passwordd) {
  const rounds = getNumberOfRounds();
  return await bcryptjs.hash(passwordd, rounds);
}

function getNumberOfRounds() {
  return process.env.NODE_ENV === "production" ? 14 : 1;
}

async function compare(providedPasswordd, storedPassword) {
  return await bcryptjs.compare(providedPasswordd, storedPassword);
}

const password = {
  hash,
  compare,
};

export default password;
