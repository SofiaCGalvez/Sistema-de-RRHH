// dashboard.js

fetch("http://localhost:3000/api/departments")
  .then(res => res.json())
  .then(data => {
    const container = document.getElementById("departments");

    const max = Math.max(...data.map(d => d.total));

    container.innerHTML = ""; // limpiar antes

    data.forEach(d => {
      const percent = (d.total / max) * 100;

      container.innerHTML += `
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-sm text-slate-600">${d.dept_name}</span>
            <span class="text-sm font-semibold text-slate-800">${d.total}</span>
          </div>
          <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div class="h-full rounded-full bg-emerald-500"
                 style="width: ${percent}%;">
            </div>
          </div>
        </div>
      `;
    });
  })
  .catch(err => console.log(err));