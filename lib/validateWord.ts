export async function validateWord(word: string): Promise<boolean> {
  try {
    const res = await fetch("/api/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word }),
    });
    const data = await res.json();
    return data.valid;
  } catch {
    return false;
  }
}
