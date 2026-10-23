const sheetId = 'YOUR_PUBLIC_SHEET_ID';
const sheetName = 'Sheet1';
const url = `https://google.com{sheetId}/gviz/tq?sheet=${sheetName}`;

fetch(url)
  .then(res => res.text())
  .then(data => {
    // Google returns data inside a protective text wrapper: /*O_o*/ \n google.visualization.Query.setResponse({...});
    // This removes the wrapper syntax to isolate raw JSON:
    const temp = data.substring(data.indexOf("(") + 1, data.lastIndexOf(")"));
    const jsData = JSON.parse(temp);
    console.log(jsData.table.rows); // Access sheet rows cleanly
  })
  .catch((error) => {
    // Runs if the promise fails or an error is thrown above
    console.error("Error encountered:", error);
  });