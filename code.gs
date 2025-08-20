function doGet(e) {
  let response;
  // Memeriksa apakah ada parameter 'id' untuk menentukan fungsi mana yang akan dipanggil
  if (e.parameter.id) {
    response = getProductById(e); // Mengirim event object ke fungsi
  } else {
    response = getAllProducts();
  }

  // Menambahkan header CORS ke response sebelum mengirimkannya
  // NOTE: .withHeaders is not a valid method in this context.
  // By returning the response directly, we allow Google Apps Script to handle CORS.
  return response;
}

function getProductById(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("produk");
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Sheet 'produk' not found." }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    const id = e.parameter.id; // Mengambil id dari event object

    const idColumnIndex = headers.indexOf("id_produk");
    if (idColumnIndex === -1) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Column 'id_produk' not found." }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const productRow = data.find(row => row[idColumnIndex] == id);

    if (productRow) {
      let product = {};
      headers.forEach((header, index) => {
        product[header] = productRow[index];
      });
      return ContentService.createTextOutput(JSON.stringify({ success: true, data: product }))
        .setMimeType(ContentService.MimeType.JSON);
    } else {
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Product not found." }))
        .setMimeType(ContentService.MimeType.JSON);
    }

  } catch (err) {
    Logger.log(err);
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getAllProducts() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("produk");
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Sheet 'produk' not found." }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    const products = data.map(row => {
      let product = {};
      headers.forEach((header, index) => {
        product[header] = row[index];
      });
      return product;
    });
    return ContentService.createTextOutput(JSON.stringify({ success: true, data: products }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}