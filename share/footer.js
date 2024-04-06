document.addEventListener("DOMContentLoaded", function () {
  fetch("../share/footer.html")
    .then((response) => response.text())
    .then((data) => {
      document.querySelector("footer").innerHTML = data;
    });
});
