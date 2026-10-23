const sheetId = '1zd9E7284QgXLppdIHDb7LYYgF8gSzHkn4IkBRbgfbgk';
const sheetName = 'Sheet1';
const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?sheet=${sheetName}`;
//https://docs.google.com/spreadsheets/d/1zd9E7284QgXLppdIHDb7LYYgF8gSzHkn4IkBRbgfbgk/edit?usp=sharing
fetch(url)
  .then(res => res.text())
  .then(data => {
    // Google returns data inside a protective text wrapper: /*O_o*/ \n google.visualization.Query.setResponse({...});
    // This removes the wrapper syntax to isolate raw JSON:
    const temp = data.substring(data.indexOf("(") + 1, data.lastIndexOf(")"));
    const jsData = JSON.parse(temp);
    console.log(jsData.table.rows); // Access sheet rows cleanly
    const rows = jsData.table.rows;
    const cols = rows[0];
    return { cols, rows: rows.slice(1) };
  })
  .catch((error) => {
    // Runs if the promise fails or an error is thrown above
    console.error("Error encountered:", error);
  });