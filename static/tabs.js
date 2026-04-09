const darkChartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: "#cfabdb" } },
    tooltip: {
      backgroundColor: "#332d35",
      titleColor: "#cfabdb",
      bodyColor: "#ffffff",
      borderColor: "#8e44ad",
      borderWidth: 1
    }
  },
  scales: {
    x: {
      grid: { color: "rgba(96,92,98,0.3)" },
      ticks: { color: "#8b8b8b", maxTicksLimit: 10 }
    },
    y: {
      grid: { color: "rgba(96,92,98,0.3)" },
      ticks: { color: "#8b8b8b" }
    }
  }
};

function showToast(message, type = "info") {
  return;
}

window.darkChartDefaults = darkChartDefaults;
window.showToast = showToast;

document.addEventListener("DOMContentLoaded", () => {
  const toggleButton = document.getElementById("sidebarToggle");
  const sidebar = document.getElementById("appSidebar");
  if (!toggleButton || !sidebar) {
    return;
  }

  const widthTransitionMs = 200;
  let textRevealTimer = null;

  const setIconOnly = iconOnly => {
    if (textRevealTimer) {
      clearTimeout(textRevealTimer);
      textRevealTimer = null;
    }

    if (iconOnly) {
      document.body.classList.add("sidebar-text-hidden");
      requestAnimationFrame(() => {
        document.body.classList.add("sidebar-icon-only");
      });
      toggleButton.setAttribute("aria-expanded", "false");
      return;
    }

    document.body.classList.remove("sidebar-icon-only");
    textRevealTimer = window.setTimeout(() => {
      document.body.classList.remove("sidebar-text-hidden");
      textRevealTimer = null;
    }, widthTransitionMs);
    toggleButton.setAttribute("aria-expanded", "true");
  };

  toggleButton.addEventListener("click", () => {
    const iconOnly = !document.body.classList.contains("sidebar-icon-only");
    setIconOnly(iconOnly);
  });
});
