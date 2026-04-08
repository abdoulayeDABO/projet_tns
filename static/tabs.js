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
  const host = document.getElementById("toastContainer");
  if (!host) {
    return;
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  host.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 4000);
}

window.darkChartDefaults = darkChartDefaults;
window.showToast = showToast;
