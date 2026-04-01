document.addEventListener("DOMContentLoaded", function() {
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabButtons.forEach(button => {
    button.addEventListener("click", function() {
      const tabId = this.getAttribute("data-tab");

      // Désactiver tous les onglets
      tabButtons.forEach(btn => {
        btn.classList.remove("active", "border-cyan-400", "text-cyan-400");
        btn.classList.add("text-slate-400", "border-transparent");
      });

      tabContents.forEach(content => {
        content.classList.add("hidden");
        content.classList.remove("block");
      });

      // Activer l'onglet sélectionné
      this.classList.add("active", "border-cyan-400", "text-cyan-400");
      this.classList.remove("text-slate-400", "border-transparent");

      document.getElementById(tabId).classList.remove("hidden");
      document.getElementById(tabId).classList.add("block");
    });
  });
});
