// Regions and kitchen counts from the client's request (one mud scraper per kitchen).
// Edit this list if the scope changes — every table and total updates from it.
const REGIONS = [
  { name: "Murang'a", kitchens: 69 },
  { name: "Embu", kitchens: 20 },
  { name: "Nyandarua", kitchens: 21 },
  { name: "Tetu", kitchens: 10 },
  { name: "Mukurwe-ini", kitchens: 9 },
  { name: "Molo", kitchens: 9 },
  { name: "Siaya", kitchens: 10 },
  { name: "Uasin Gishu", kitchens: 33 },
  { name: "Narok", kitchens: 4 },
];

document.addEventListener("DOMContentLoaded", function () {
  const $ = (id) => document.getElementById(id);
  const unitRateEl = $("unitRate");
  const vatRateEl = $("vatRate");

  function fmt(n) {
    return Number(n).toLocaleString("en-KE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  // Default date to today; the field stays editable
  const today = new Date();
  $("currentDate").value = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  // ── Build the region rows ────────────────────────────────
  const totalKitchens = REGIONS.reduce((sum, r) => sum + r.kitchens, 0);

  REGIONS.forEach((region, i) => {
    const costRow = document.createElement("tr");
    costRow.innerHTML = `
      <td>${i + 1}</td>
      <td>${region.name}</td>
      <td class="num">${region.kitchens}</td>
      <td class="num">${region.kitchens}</td>
      <td class="num rate-cell">&ndash;</td>
      <td class="num total-cell">&ndash;</td>`;
    $("costRows").appendChild(costRow);

    const timeRow = document.createElement("tr");
    timeRow.innerHTML = `
      <td>${i + 1}</td>
      <td>${region.name}</td>
      <td class="num">${region.kitchens}</td>
      <td><input type="text" class="cell-input" placeholder="e.g. 2 weeks" /></td>
      <td><input type="text" class="cell-input" placeholder="e.g. 1 week" /></td>`;
    $("timelineRows").appendChild(timeRow);
  });

  $("totalKitchens").textContent = totalKitchens;
  $("totalScrapers").textContent = totalKitchens;

  // ── Totals ───────────────────────────────────────────────
  function recalculate() {
    const rate = parseFloat(unitRateEl.value);
    const hasRate = rate > 0;
    const vatRate = Math.max(0, parseFloat(vatRateEl.value) || 0);

    document.querySelectorAll("#costRows tr").forEach((row, i) => {
      row.querySelector(".rate-cell").textContent = hasRate ? fmt(rate) : "–";
      row.querySelector(".total-cell").textContent = hasRate
        ? fmt(rate * REGIONS[i].kitchens)
        : "–";
    });

    const subtotal = hasRate ? rate * totalKitchens : 0;
    const vat = (subtotal * vatRate) / 100;
    $("costSubtotal").textContent = fmt(subtotal);
    $("subtotal").textContent = fmt(subtotal);
    $("vatAmount").textContent = fmt(vat);
    $("grandTotal").textContent = fmt(subtotal + vat);
  }

  unitRateEl.addEventListener("input", recalculate);
  vatRateEl.addEventListener("input", recalculate);
  recalculate();

  // ── Export helpers ───────────────────────────────────────

  // Text an input should show in the exported document
  function exportText(input) {
    if (input.id === "unitRate") return input.value ? fmt(input.value) : "";
    return input.value;
  }

  function buildFilename(ext) {
    const num = $("quotationNumber").value.trim().replace(/[^a-zA-Z0-9_-]/g, "");
    return `Quotation_Mud_Scrapers_Marachi_Entrepreneurs_Ltd${num ? "_" + num : ""}.${ext}`;
  }

  function readyToExport() {
    if (!(parseFloat(unitRateEl.value) > 0)) {
      alert("Please enter the unit rate per mud scraper before downloading.");
      unitRateEl.focus();
      return false;
    }
    const emptyTimelines = [...document.querySelectorAll("#timelineRows input")].some(
      (el) => !el.value.trim()
    );
    if (emptyTimelines) {
      return confirm(
        "Some fabrication / installation timelines are still empty. Download anyway?"
      );
    }
    return true;
  }

  // ── PDF export ───────────────────────────────────────────
  window.downloadQuotation = function () {
    if (!readyToExport()) return;

    // html2canvas doesn't render input values — swap inputs with text spans
    const swapped = [];
    document.querySelectorAll("#quotationContent input").forEach((input) => {
      const span = document.createElement("span");
      span.textContent = exportText(input);
      span.className = input.className + " as-text";
      input.parentNode.insertBefore(span, input);
      input.style.display = "none";
      swapped.push({ input, span });
    });

    const content = $("quotationContent");
    content.classList.add("exporting");

    const restore = () => {
      content.classList.remove("exporting");
      swapped.forEach(({ input, span }) => {
        input.style.display = "";
        span.remove();
      });
    };

    html2pdf()
      .from(content)
      .set({
        margin: [8, 8, 8, 8],
        filename: buildFilename("pdf"),
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, windowWidth: 900 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"], avoid: ["tr", ".avoid-break", ".totals-wrap"] },
      })
      .save()
      .then(restore, restore);
  };

  // ── Word export ──────────────────────────────────────────
  window.downloadQuotationAsWord = function () {
    if (!readyToExport()) return;

    const source = $("quotationContent");
    const content = source.cloneNode(true);
    const liveInputs = source.querySelectorAll("input");
    content.querySelectorAll("input").forEach((el, i) => {
      const span = document.createElement("span");
      span.textContent = exportText(liveInputs[i]);
      el.parentNode.replaceChild(span, el);
    });
    // Word needs absolute image URLs
    content.querySelectorAll("img").forEach((img) => (img.src = img.src));

    const css = `<style>
      body { font-family: Arial, sans-serif; color: #222; font-size: 10.5pt; }
      h1.company-name { font-size: 24pt; color: #111; margin: 0; }
      .logo p { color: #830606; font-weight: bold; font-size: 9pt; }
      .logo img { width: 74px; height: 74px; }
      .dealers { font-size: 9pt; text-align: center; color: #555; border-top: 2px solid #830606; padding: 6px 0; }
      .word { text-align: center; font-size: 13pt; letter-spacing: 4px; color: #fff; background: #830606; padding: 5px; }
      .meta-col-label, .meta-label { font-weight: bold; }
      .section-title { font-size: 11pt; color: #830606; border-bottom: 1px solid #ccc; margin: 14px 0 6px; }
      table { border-collapse: collapse; width: 100%; }
      .q-table th { background: #830606; color: #fff; font-size: 9pt; padding: 5px 7px; text-align: left; border: 1px solid #5a0707; }
      .q-table td { border: 1px solid #bbb; padding: 5px 7px; font-size: 10pt; }
      .q-table tfoot td { font-weight: bold; background: #f1f1f1; }
      .num { text-align: right; }
      .totals-table { width: 45%; margin: 10px 0 0 auto; }
      .totals-table td { border: 1px solid #bbb; padding: 5px 9px; }
      .totals-table tr.grand td { background: #830606; color: #fff; font-weight: bold; }
      .notes li { margin-bottom: 4px; }
      .dot img { width: 56px; }
      .pin { font-weight: bold; font-size: 9pt; }
    </style>`;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Quotation</title>${css}</head><body>${content.innerHTML}</body></html>`;
    const blob = new Blob(["﻿", html], { type: "application/msword" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = buildFilename("doc");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };
});
