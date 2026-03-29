export function formatDateTime(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}

export function normalizeDateTimeInput(value) {
  const fullwidthMap = {
    "／": "/",
    "：": ":",
    "　": " "
  };

  let normalized = "";
  for (const char of value) {
    if (char >= "０" && char <= "９") {
      normalized += String.fromCharCode(char.charCodeAt(0) - 65248);
      continue;
    }
    normalized += fullwidthMap[char] || char;
  }

  return normalized.replace(/[^0-9/: ]/g, "");
}

export function parseDateTimeInput(rawValue, baseDate) {
  const value = normalizeDateTimeInput(rawValue).trim().replace(/\s+/g, " ");
  if (!value) {
    return null;
  }

  const firstSpaceIndex = value.indexOf(" ");
  const datePart = firstSpaceIndex === -1 ? value : value.slice(0, firstSpaceIndex);
  const timePart = firstSpaceIndex === -1 ? "" : value.slice(firstSpaceIndex + 1).trim();

  const dateFields = datePart.split("/");
  if (dateFields.length < 1 || dateFields.length > 3) {
    return null;
  }

  if (!/^\d{4}$/.test(dateFields[0])) {
    return null;
  }

  if (dateFields.slice(1).some((field) => !/^\d{1,2}$/.test(field))) {
    return null;
  }

  const result = new Date(baseDate.getTime());
  const year = Number(dateFields[0]);
  const month = dateFields[1] === undefined ? result.getMonth() + 1 : Number(dateFields[1]);
  const day = dateFields[2] === undefined ? result.getDate() : Number(dateFields[2]);

  if (month < 1 || month > 12) {
    return null;
  }

  result.setFullYear(year, month - 1, 1);
  const maxDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  if (day < 1 || day > maxDay) {
    return null;
  }

  let timeFields = [];
  if (timePart) {
    timeFields = timePart.replace(/:/g, " ").split(" ").filter(Boolean);
    if (timeFields.length < 1 || timeFields.length > 3) {
      return null;
    }

    if (timeFields.some((field) => !/^\d{1,2}$/.test(field))) {
      return null;
    }
  }

  const hours = timeFields[0] === undefined ? result.getHours() : Number(timeFields[0]);
  const minutes = timeFields[1] === undefined ? result.getMinutes() : Number(timeFields[1]);
  const seconds = timeFields[2] === undefined ? result.getSeconds() : Number(timeFields[2]);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
    return null;
  }

  result.setFullYear(year, month - 1, day);
  result.setHours(hours, minutes, seconds, 0);
  return result;
}
