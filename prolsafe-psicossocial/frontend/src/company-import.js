import './styles/company-import.css';

const API = 'https://prolsafe-psicosocial-api.onrender.com';

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function findSidebarButton(label) {
  return [...document.querySelectorAll('.sidebar button')].find(button =>
    button.textContent.trim().toLowerCase().includes(label.toLowerCase())
  );
}

function refreshCompaniesPage() {
  const dashboard = findSidebarButton('Dashboard');
  const companies = findSidebarButton('Empresas');

  if (dashboard && companies) {
    dashboard.click();
    window.setTimeout(() => companies.click(), 80);
    return;
  }

  window.location.reload();
}

function buildImportPanel() {
  const panel = createElement('section', 'panel company-import-panel');
  panel.dataset.companyImport = 'true';

  const header = createElement('div', 'company-import-header');
  const icon = createElement('div', 'company-import-icon', 'XLS');
  const heading = createElement('div');
  heading.append(
    createElement('h2', '', 'Importar empresa pelo Modelo 1 do SOC'),
    createElement(
      'p',
      'muted',
      'A planilha cadastra automaticamente os dados da empresa, os setores e a quantidade de colaboradores por setor.'
    )
  );
  header.append(icon, heading);

  const dropzone = createElement('label', 'company-import-dropzone');
  dropzone.tabIndex = 0;

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xls,.xlsx';
  input.hidden = true;

  const dropTitle = createElement('strong', '', 'Selecionar planilha XLS ou XLSX');
  const dropText = createElement(
    'span',
    '',
    'Clique aqui ou arraste o arquivo do Modelo 1 para esta área.'
  );
  const fileName = createElement('small', 'company-import-file', 'Nenhum arquivo selecionado');

  dropzone.append(input, dropTitle, dropText, fileName);

  const footer = createElement('div', 'company-import-footer');
  const helper = createElement(
    'span',
    'company-import-helper',
    'Se o CNPJ já existir, os dados e setores serão atualizados sem excluir avaliações anteriores.'
  );
  const button = createElement('button', 'company-import-button', 'Importar e cadastrar');
  button.type = 'button';
  button.disabled = true;
  footer.append(helper, button);

  const status = createElement('div', 'company-import-status');
  status.hidden = true;

  let selectedFile = null;

  function selectFile(file) {
    if (!file) return;

    const valid = /\.(xls|xlsx)$/i.test(file.name);
    if (!valid) {
      selectedFile = null;
      input.value = '';
      fileName.textContent = 'Formato inválido. Selecione um arquivo XLS ou XLSX.';
      dropzone.classList.add('is-error');
      button.disabled = true;
      return;
    }

    selectedFile = file;
    fileName.textContent = `${file.name} · ${(file.size / 1024).toFixed(1)} KB`;
    dropzone.classList.remove('is-error');
    dropzone.classList.add('has-file');
    button.disabled = false;
  }

  function showStatus(type, message) {
    status.hidden = false;
    status.className = `company-import-status ${type}`;
    status.textContent = message;
  }

  input.addEventListener('change', event => {
    selectFile(event.target.files?.[0]);
  });

  dropzone.addEventListener('dragover', event => {
    event.preventDefault();
    dropzone.classList.add('is-dragging');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('is-dragging');
  });

  dropzone.addEventListener('drop', event => {
    event.preventDefault();
    dropzone.classList.remove('is-dragging');
    selectFile(event.dataTransfer?.files?.[0]);
  });

  button.addEventListener('click', async () => {
    if (!selectedFile) return;

    const token = localStorage.getItem('ps_token');
    if (!token) {
      showStatus('error', 'Sua sessão expirou. Faça login novamente antes de importar.');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);

    button.disabled = true;
    button.textContent = 'Importando planilha...';
    showStatus('loading', 'Lendo dados da empresa e agrupando os colaboradores por setor.');

    try {
      const response = await fetch(`${API}/companies/import`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível importar a planilha.');
      }

      const companyName =
        data.company?.nomeFantasia || data.company?.razaoSocial || 'Empresa';
      const action = data.mode === 'updated' ? 'atualizada' : 'cadastrada';

      showStatus(
        'success',
        `${companyName} ${action} com sucesso: ${data.summary?.sectors || 0} setores e ${data.summary?.employees || 0} colaboradores.`
      );

      selectedFile = null;
      input.value = '';
      fileName.textContent = 'Nenhum arquivo selecionado';
      dropzone.classList.remove('has-file');

      window.setTimeout(refreshCompaniesPage, 1200);
    } catch (error) {
      showStatus('error', error.message || 'Erro ao importar a planilha.');
      button.disabled = false;
    } finally {
      button.textContent = 'Importar e cadastrar';
    }
  });

  panel.append(header, dropzone, footer, status);
  return panel;
}

function mountCompanyImport() {
  const main = [...document.querySelectorAll('main')].find(element => {
    const title = element.querySelector('h1');
    return title?.textContent.trim() === 'Cadastro de Empresas';
  });

  if (!main || main.querySelector('[data-company-import]')) return;

  const form = main.querySelector('form.form.panel');
  if (!form) return;

  form.before(buildImportPanel());
}

const observer = new MutationObserver(mountCompanyImport);
observer.observe(document.documentElement, {
  childList: true,
  subtree: true
});

window.addEventListener('DOMContentLoaded', mountCompanyImport);
window.setTimeout(mountCompanyImport, 250);
