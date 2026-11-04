const form = document.querySelector('.search');
const input = form.elements.q;
const rows = [...document.querySelectorAll('.entry')];
const groups = [...document.querySelectorAll('.owner-group')];
const status = document.querySelector('.status');
const empty = document.querySelector('#empty');

function filter() {
  const terms = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let count = 0;
  for (const row of rows) {
    const text = row.textContent.toLowerCase();
    row.hidden = !terms.every(term => text.includes(term));
    if (!row.hidden) count++;
  }
  for (const group of groups) {
    group.hidden = !group.querySelector('.entry:not([hidden])');
  }
  const noun = groups.length ? 'owner report' : 'report';
  status.textContent = count + ' ' + noun + (count === 1 ? '' : 's');
  empty.hidden = count !== 0;
}

input.value = new URLSearchParams(location.search).get('q') ?? '';
form.hidden = false;
form.addEventListener('submit', event => event.preventDefault());
input.addEventListener('input', filter);
filter();
