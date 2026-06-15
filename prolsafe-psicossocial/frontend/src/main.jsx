import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Building2,
  ClipboardList,
  FileText,
  Send,
  Users,
  ShieldCheck
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import './styles/global.css';

const API = 'https://prolsafe-psicosocial-production.up.railway.app';

const getToken = () => localStorage.getItem('ps_token');

async function api(path, opts = {}) {
  const r = await fetch(API + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: getToken() ? `Bearer ${getToken()}` : undefined,
      ...opts.headers
    }
  });

  const data = await r.json().catch(() => ({}));

  if (!r.ok) {
    throw new Error(data.error || 'Erro na requisição');
  }

  return data;
}

function riskClass(score) {
  if (score <= 1) return 'critical';
  if (score <= 2) return 'high';
  if (score <= 3) return 'medium';
  return 'low';
}

function Login({ onLogin }) {
  const [email, setEmail] = useState('admin@prolsafe.com.br');
  const [password, setPassword] = useState('admin123');
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    setErr('');

    try {
      const d = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      localStorage.setItem('ps_token', d.token);
      localStorage.setItem('ps_user', JSON.stringify(d.user));
      onLogin(d.user);
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="logo big">PS</div>
        <h1>ProlSafe Psicossocial</h1>
        <p>Gestão premium de avaliações psicossociais organizacionais.</p>

        <input
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="E-mail"
        />

        <input
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Senha"
          type="password"
        />

        <button>Entrar</button>

        {err && <small className="error">{err}</small>}

        <a>Recuperar senha</a>
        <small>Login teste: admin@prolsafe.com.br / admin123</small>
      </form>
    </div>
  );
}

function Sidebar({ page, setPage, logout }) {
  const items = [
    ['dashboard', 'Dashboard', ShieldCheck],
    ['empresas', 'Empresas', Building2],
    ['questionarios', 'Questionários', ClipboardList],
    ['resultados', 'Resultados', FileText],
    ['plano', 'Plano de Ação', Send]
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="logo">PS</div>
        <div>
          <b>ProlSafe</b>
          <span>Psicossocial</span>
        </div>
      </div>

      {items.map(([id, label, Icon]) => (
        <button
          className={page === id ? 'active' : ''}
          onClick={() => setPage(id)}
          key={id}
        >
          <Icon size={18} />
          {label}
        </button>
      ))}

      <button onClick={logout}>Sair</button>
    </aside>
  );
}

function Card({ icon: Icon, title, value, sub }) {
  return (
    <div className="card">
      <div className="card-icon">
        <Icon size={22} />
      </div>
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{sub}</small>
    </div>
  );
}

function Dashboard({ setPage }) {
  const [companies, setCompanies] = useState([]);
  const [qs, setQs] = useState([]);

  useEffect(() => {
    api('/companies').then(setCompanies).catch(console.error);
    api('/questionnaires/default').then(setQs).catch(console.error);
  }, []);

  const ass = companies.flatMap(c => c.assessments || []);

  return (
    <main>
      <h1>Dashboard Administrativo</h1>
      <p className="muted">
        Visão executiva das empresas, questionários e riscos psicossociais.
      </p>

      <section className="grid cards">
        <Card
          icon={Building2}
          title="Empresas cadastradas"
          value={companies.length}
          sub={`${companies.filter(c => c.status === 'ATIVA' || c.status === 'AVALIACAO_EM_ANDAMENTO').length} ativas`}
        />

        <Card
          icon={ClipboardList}
          title="Questionários ativos"
          value={ass.filter(a => a.status === 'ATIVA').length}
          sub="Aplicações em andamento"
        />

        <Card
          icon={Users}
          title="Respostas recebidas"
          value="—"
          sub="Abra Resultados"
        />

        <Card
          icon={FileText}
          title="Dimensões HSE-IT"
          value={qs.length}
          sub="Banco padrão"
        />
      </section>

      <section className="panel">
        <div className="actions">
          <button onClick={() => setPage('empresas')}>Nova Empresa</button>
          <button onClick={() => setPage('questionarios')}>Novo Questionário</button>
          <button onClick={() => setPage('questionarios')}>Enviar Questionário</button>
          <button onClick={() => setPage('resultados')}>Gerar Relatório</button>
        </div>
      </section>
    </main>
  );
}

function Empresas() {
  const [companies, setCompanies] = useState([]);
  const [msg, setMsg] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [sectorName, setSectorName] = useState('');
  const [sectorEmployees, setSectorEmployees] = useState('');

  const emptyForm = {
    razaoSocial: '',
    nomeFantasia: '',
    cnpj: '',
    cnae: '',
    grauRisco: '',
    endereco: '',
    cidadeEstado: '',
    responsavel: '',
    email: '',
    telefone: '',
    totalColabs: 0,
    status: 'ATIVA'
  };

  const [f, setF] = useState(emptyForm);

  const labels = {
    razaoSocial: 'Razão Social',
    nomeFantasia: 'Nome Fantasia',
    cnpj: 'CNPJ',
    cnae: 'CNAE',
    grauRisco: 'Grau de Risco',
    endereco: 'Endereço',
    cidadeEstado: 'Cidade/Estado',
    responsavel: 'Responsável da Empresa',
    email: 'E-mail',
    telefone: 'Telefone/WhatsApp',
    totalColabs: 'Quantidade de Colaboradores',
    status: 'Status'
  };

  const load = async () => {
    const data = await api('/companies');
    setCompanies(data);

    if (viewing) {
      const updated = data.find(c => c.id === viewing.id);
      if (updated) setViewing(updated);
    }
  };

  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setF(emptyForm);
    setEditingId(null);
    setViewing(null);
  }

  async function save(e) {
    e.preventDefault();
    setMsg('');

    const payload = {
      ...f,
      totalColabs: Number(f.totalColabs),
      sectors: []
    };

    try {
      if (editingId) {
        await api('/companies/' + editingId, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });

        setMsg('Empresa atualizada com sucesso.');
      } else {
        await api('/companies', {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        setMsg('Empresa cadastrada com sucesso.');
      }

      resetForm();
      load();
    } catch (e) {
      setMsg(e.message);
    }
  }

  function editCompany(c) {
    setEditingId(c.id);
    setViewing(null);

    setF({
      razaoSocial: c.razaoSocial || '',
      nomeFantasia: c.nomeFantasia || '',
      cnpj: c.cnpj || '',
      cnae: c.cnae || '',
      grauRisco: c.grauRisco || '',
      endereco: c.endereco || '',
      cidadeEstado: c.cidadeEstado || '',
      responsavel: c.responsavel || '',
      email: c.email || '',
      telefone: c.telefone || '',
      totalColabs: c.totalColabs || 0,
      status: c.status || 'ATIVA'
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function deleteCompany(id) {
    const confirmDelete = window.confirm(
      'Tem certeza que deseja excluir esta empresa?'
    );

    if (!confirmDelete) return;

    try {
      await api('/companies/' + id, {
        method: 'DELETE'
      });

      setMsg('Empresa excluída com sucesso.');
      load();
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function changeStatus(c, status) {
    try {
      await api('/companies/' + c.id, {
        method: 'PUT',
        body: JSON.stringify({
          ...c,
          status
        })
      });

      setMsg('Status alterado com sucesso.');
      load();
    } catch (e) {
      setMsg(e.message);
    }
  }

  function viewCompany(c) {
    const company = companies.find(x => x.id === c.id);
    setViewing(company || c);
    setEditingId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function addSector(companyId) {
    if (!sectorName.trim()) {
      setMsg('Informe o nome do setor.');
      return;
    }

    try {
      await api(`/companies/${companyId}/sectors`, {
        method: 'POST',
        body: JSON.stringify({
          name: sectorName,
          employees: Number(sectorEmployees || 0)
        })
      });

      setSectorName('');
      setSectorEmployees('');
      setMsg('Setor cadastrado com sucesso.');
      load();
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function deleteSector(sectorId) {
    if (!window.confirm('Deseja excluir este setor?')) return;

    try {
      await api(`/companies/sectors/${sectorId}`, {
        method: 'DELETE'
      });

      setMsg('Setor removido com sucesso.');
      load();
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function updateSector(sector) {
    const newName = window.prompt('Nome do setor:', sector.name);
    if (!newName) return;

    const newEmployees = window.prompt(
      'Quantidade de colaboradores:',
      sector.employees
    );

    try {
      await api(`/companies/sectors/${sector.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: newName,
          employees: Number(newEmployees || 0)
        })
      });

      setMsg('Setor atualizado com sucesso.');
      load();
    } catch (e) {
      setMsg(e.message);
    }
  }

  const viewingTotal = (viewing?.sectors || []).reduce(
    (sum, s) => sum + Number(s.employees || 0),
    0
  );

  return (
    <main>
      <h1>Cadastro de Empresas</h1>
      <p className="muted">
        Cadastre empresas e personalize os setores avaliados em cada organização.
      </p>

      <form className="form panel" onSubmit={save}>
        <h2>{editingId ? 'Editar Empresa' : 'Nova Empresa'}</h2>

        {Object.keys(f).map(k => (
          <div className="field" key={k}>
            <label>{labels[k]}</label>

            {k === 'status' ? (
              <select
                value={f[k]}
                onChange={e => setF({ ...f, [k]: e.target.value })}
              >
                <option value="ATIVA">Ativa</option>
                <option value="INATIVA">Inativa</option>
                <option value="AVALIACAO_EM_ANDAMENTO">
                  Avaliação em andamento
                </option>
                <option value="RELATORIO_CONCLUIDO">
                  Relatório concluído
                </option>
              </select>
            ) : (
              <input
                value={f[k]}
                onChange={e => setF({ ...f, [k]: e.target.value })}
                placeholder={labels[k]}
                type={k === 'totalColabs' ? 'number' : 'text'}
              />
            )}
          </div>
        ))}

        <div className="actions">
          <button>{editingId ? 'Salvar Alterações' : 'Cadastrar Empresa'}</button>

          {editingId && (
            <button type="button" onClick={resetForm}>
              Cancelar Edição
            </button>
          )}
        </div>

        {msg && <small className="success">{msg}</small>}
      </form>

      {viewing && (
        <div className="panel">
          <h2>Dados da Empresa</h2>

          <div className="company-details">
            {Object.keys(labels).map(k => (
              <div key={k}>
                <span>{labels[k]}</span>
                <b>{viewing[k] || 'Não informado'}</b>
              </div>
            ))}
          </div>

          <div className="panel">
            <h3>Setores da Empresa</h3>
            <p className="muted">
              Total por setores: {viewingTotal} colaboradores
            </p>

            <div className="actions">
              <input
                placeholder="Nome do setor"
                value={sectorName}
                onChange={e => setSectorName(e.target.value)}
              />

              <input
                type="number"
                placeholder="Colaboradores"
                value={sectorEmployees}
                onChange={e => setSectorEmployees(e.target.value)}
              />

              <button type="button" onClick={() => addSector(viewing.id)}>
                Adicionar Setor
              </button>
            </div>

            {(viewing.sectors || []).length === 0 && (
              <p className="muted">Nenhum setor cadastrado para esta empresa.</p>
            )}

            {(viewing.sectors || []).map(sector => (
              <div className="company-row" key={sector.id}>
                <div>
                  <b>{sector.name}</b>
                  <small>{sector.employees} colaboradores</small>
                </div>

                <div className="row-actions">
                  <button type="button" onClick={() => updateSector(sector)}>
                    Editar
                  </button>

                  <button
                    type="button"
                    className="danger"
                    onClick={() => deleteSector(sector.id)}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="actions">
            <button onClick={() => editCompany(viewing)}>Editar Empresa</button>
            <button onClick={() => setViewing(null)}>Fechar Visualização</button>
          </div>
        </div>
      )}

      <div className="panel">
        <h2>Empresas Cadastradas</h2>

        {companies.length === 0 && (
          <p className="muted">Nenhuma empresa cadastrada ainda.</p>
        )}

        {companies.map(c => (
          <div className="company-row" key={c.id}>
            <div>
              <b>{c.nomeFantasia || c.razaoSocial}</b>
              <small>
                {c.cnpj || 'CNPJ não informado'} • {(c.sectors || []).length} setores
              </small>
            </div>

            <select
              value={c.status || 'ATIVA'}
              onChange={e => changeStatus(c, e.target.value)}
            >
              <option value="ATIVA">Ativa</option>
              <option value="INATIVA">Inativa</option>
              <option value="AVALIACAO_EM_ANDAMENTO">
                Avaliação em andamento
              </option>
              <option value="RELATORIO_CONCLUIDO">
                Relatório concluído
              </option>
            </select>

            <div className="row-actions">
              <button onClick={() => viewCompany(c)}>Ver / Setores</button>
              <button onClick={() => editCompany(c)}>Editar</button>
              <button className="danger" onClick={() => deleteCompany(c.id)}>
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

function Questionarios() {
  const [dims, setDims] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState('');
  const [created, setCreated] = useState(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api('/questionnaires/default').then(setDims);

    api('/companies').then(cs => {
      setCompanies(cs);
      setCompanyId(cs[0]?.id || '');
    });
  }, []);

  async function createAssessment() {
    setMsg('');

    if (!companyId) {
      setMsg('Cadastre uma empresa antes de gerar o questionário.');
      return;
    }

    const a = await api('/assessments', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Avaliação Psicossocial Organizacional',
        companyId
      })
    });

    setCreated(a);
    setMsg('Questionário gerado com sucesso.');
  }

  const selectedCompany = companies.find(c => c.id === companyId);

  return (
    <main>
      <h1>Módulo de Questionários</h1>
      <p className="muted">
        Gere links seguros para aplicação da avaliação psicossocial por empresa.
      </p>

      <div className="panel">
        <div className="field">
          <label>Empresa Avaliada</label>
          <select value={companyId} onChange={e => setCompanyId(e.target.value)}>
            <option value="">Selecione uma empresa</option>
            {companies.map(c => (
              <option value={c.id} key={c.id}>
                {c.nomeFantasia || c.razaoSocial}
              </option>
            ))}
          </select>
        </div>

        {selectedCompany && (
          <div className="notice">
            <b>Empresa selecionada:</b>{' '}
            {selectedCompany.nomeFantasia || selectedCompany.razaoSocial}
            <br />
            <b>CNPJ:</b> {selectedCompany.cnpj || 'Não informado'}
            <br />
            <b>Status:</b> {selectedCompany.status}
            <br />
            <b>Setores:</b> {(selectedCompany.sectors || []).length}
          </div>
        )}

        <h2>Instrumento HSE-IT</h2>

        <div className="grid dimcards">
          {dims.map(d => (
            <div className="dimension low" key={d.id}>
              <span>{d.name}</span>
              <strong>{d.questions.length}</strong>
              <small>
                perguntas • pontuação {d.inverted ? 'invertida' : 'normal'}
              </small>
            </div>
          ))}
        </div>

        <div className="actions">
          <button onClick={createAssessment}>Gerar Link e QR Code</button>

          {created && (
            <>
              <button onClick={() => navigator.clipboard.writeText(created.link)}>
                Copiar Link
              </button>

              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  'Olá! Acesse o questionário psicossocial da sua empresa pelo link: ' + created.link
                )}`}
                target="_blank"
                rel="noreferrer"
              >
                Enviar WhatsApp
              </a>
            </>
          )}
        </div>

        {msg && <small className="success">{msg}</small>}

        {created && (
          <div className="notice">
            <b>Link de resposta:</b>
            <br />
            <a href={created.link} target="_blank" rel="noreferrer">
              {created.link}
            </a>

            <br />
            <br />

            <b>QR Code:</b>
            <br />
            <img src={created.qrCode} width="160" />
          </div>
        )}
      </div>
    </main>
  );
}

function Resultados() {
  const [companies, setCompanies] = useState([]);
  const [assessmentId, setAssessmentId] = useState('');
  const [res, setRes] = useState(null);
  const [pdf, setPdf] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api('/companies').then(cs => {
      setCompanies(cs);
      setAssessmentId(cs.flatMap(c => c.assessments || [])[0]?.id || '');
    });
  }, []);

  async function load() {
    setMsg('');
    setPdf('');

    if (!assessmentId) {
      setMsg('Nenhuma avaliação selecionada.');
      return;
    }

    try {
      const data = await api('/results/assessment/' + assessmentId);
      setRes(data);
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function report() {
    setMsg('');

    if (!assessmentId) {
      setMsg('Selecione uma avaliação antes de gerar o PDF.');
      return;
    }

    try {
      const r = await api('/reports/assessment/' + assessmentId, {
        method: 'POST'
      });

      setPdf(API + '/reports-files/' + r.pdfUrl.split(/[\\/]/).pop());
      setMsg('Relatório PDF gerado com sucesso.');
    } catch (e) {
      setMsg(e.message);
    }
  }

  const assessments = companies.flatMap(c =>
    (c.assessments || []).map(a => ({
      ...a,
      companyName: c.nomeFantasia || c.razaoSocial
    }))
  );

  const dims = (res?.results?.byDimension || []).map(d => ({
    name: d.name,
    score: Number(d.score),
    risco: d.classification?.label || d.classification
  }));

  const sortedDims = [...dims].sort((a, b) => a.score - b.score);
  const critical = sortedDims[0];

  const average =
    dims.length > 0
      ? (dims.reduce((sum, d) => sum + d.score, 0) / dims.length).toFixed(2)
      : '—';

  return (
    <main>
      <h1>Dashboard de Resultados</h1>
      <p className="muted">
        Analise os fatores psicossociais por dimensão, risco e prioridade.
      </p>

      <div className="panel actions">
        <select
          value={assessmentId}
          onChange={e => setAssessmentId(e.target.value)}
        >
          <option value="">Selecione uma avaliação</option>

          {assessments.map(a => (
            <option value={a.id} key={a.id}>
              {a.companyName} - {a.title}
            </option>
          ))}
        </select>

        <button onClick={load}>Carregar Resultados</button>
        <button onClick={report}>Gerar PDF</button>

        {pdf && (
          <a href={pdf} target="_blank" rel="noreferrer">
            Abrir PDF
          </a>
        )}
      </div>

      {msg && <small className="success">{msg}</small>}

      {!res && (
        <div className="panel empty-state">
          <h2>Nenhum resultado carregado</h2>
          <p>
            Selecione uma avaliação e clique em “Carregar Resultados”.
            Caso ainda não existam respostas, envie o link aos colaboradores.
          </p>
        </div>
      )}

      {res && (
        <>
          <section className="grid cards">
            <Card
              icon={Users}
              title="Taxa de Resposta"
              value={`${res.responseRate || 0}%`}
              sub="Participação geral"
            />

            <Card
              icon={ShieldCheck}
              title="Score Geral"
              value={average}
              sub="Média das dimensões"
            />

            <Card
              icon={FileText}
              title="Dimensão mais crítica"
              value={critical?.name || '—'}
              sub={critical ? `Score ${critical.score}` : 'Sem dados'}
            />

            <Card
              icon={ClipboardList}
              title="Dimensões avaliadas"
              value={dims.length}
              sub="Modelo HSE-IT"
            />
          </section>

          {dims.length === 0 && (
            <div className="panel empty-state">
              <h2>Sem respostas suficientes</h2>
              <p>
                Ainda não há dados consolidados para gerar gráficos.
                Aguarde novas respostas dos colaboradores.
              </p>
            </div>
          )}

          {dims.length > 0 && (
            <>
              <section className="grid dimcards">
                {dims.map(d => (
                  <div className={`dimension ${riskClass(d.score)}`} key={d.name}>
                    <span>{d.name}</span>
                    <strong>{d.score}</strong>
                    <small>{d.risco}</small>
                  </div>
                ))}
              </section>

              <section className="grid two">
                <div className="panel">
                  <h2>Gráfico por Dimensão</h2>

                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={dims}>
                      <XAxis dataKey="name" />
                      <YAxis domain={[0, 4]} />
                      <Tooltip />
                      <Bar dataKey="score" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="panel">
                  <h2>Radar Psicossocial</h2>

                  <ResponsiveContainer width="100%" height={280}>
                    <RadarChart data={dims}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="name" />
                      <PolarRadiusAxis domain={[0, 4]} />
                      <Radar dataKey="score" />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <div className="panel">
                <h2>Ranking de Prioridade</h2>

                {sortedDims.map((d, index) => (
                  <div className="rank" key={d.name}>
                    <span>
                      <b>
                        {index + 1}. {d.name}
                      </b>
                      <small>{d.risco}</small>
                    </span>

                    <b>{d.score}</b>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}

function Plano() {
  return (
    <main>
      <h1>Plano de Ação</h1>

      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Risco</th>
              <th>Dimensão</th>
              <th>Setor</th>
              <th>Ação</th>
              <th>Responsável</th>
              <th>Prazo</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td>Sobrecarga</td>
              <td>Demandas</td>
              <td>Operacional</td>
              <td>Revisar volume de tarefas e pausas</td>
              <td>RH/SST</td>
              <td>30 dias</td>
              <td>Pendente</td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  );
}

function Colaborador() {
  const token = location.pathname.split('/').pop();
  const [data, setData] = useState(null);
  const [sectorId, setSectorId] = useState('');
  const [answers, setAnswers] = useState({});
  const [done, setDone] = useState(false);

  useEffect(() => {
    api('/assessments/public/' + token, {
      headers: { Authorization: '' }
    }).then(d => {
      setData(d);
      setSectorId(d.assessment?.company?.sectors?.[0]?.id || '');
    });
  }, []);

  if (done) {
    return (
      <div className="survey">
        <div className="survey-card">
          <h1>Resposta registrada com sucesso.</h1>
          <p>Obrigado por contribuir com a melhoria do ambiente de trabalho.</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="survey">
        <div className="survey-card">Carregando...</div>
      </div>
    );
  }

  const qs = data.dimensions.flatMap(d =>
    d.questions.map(q => ({ ...q, dim: d.name }))
  );

  async function submit() {
    await api('/assessments/public/' + token + '/responses', {
      method: 'POST',
      headers: { Authorization: '' },
      body: JSON.stringify({
        sectorId,
        answers: qs.map(q => ({
          questionId: q.id,
          value: answers[q.id] ?? 2
        }))
      })
    });

    setDone(true);
  }

  return (
    <div className="survey">
      <div className="survey-card">
        <h1>Avaliação Psicossocial Organizacional</h1>

        <p>
          Empresa:{' '}
          {data.assessment.company.nomeFantasia ||
            data.assessment.company.razaoSocial}
        </p>

        <div className="notice">
          Sua resposta é confidencial. A avaliação é organizacional, não
          clínica, diagnóstica ou individual.
        </div>

        <select value={sectorId} onChange={e => setSectorId(e.target.value)}>
          {data.assessment.company.sectors.map(s => (
            <option value={s.id} key={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <div className="progress">
          <span
            style={{
              width: (Object.keys(answers).length / qs.length) * 100 + '%'
            }}
          />
        </div>

        {qs.map((q, i) => (
          <div className="question" key={q.id}>
            <h2>
              {i + 1}. {q.text}
            </h2>

            {['Nunca', 'Raramente', 'Às vezes', 'Frequentemente', 'Sempre'].map(
              (x, v) => (
                <label className="option" key={x}>
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers[q.id] === v}
                    onChange={() => setAnswers({ ...answers, [q.id]: v })}
                  />{' '}
                  {x}
                </label>
              )
            )}
          </div>
        ))}

        <button onClick={submit}>Finalizar</button>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(() =>
    JSON.parse(localStorage.getItem('ps_user') || 'null')
  );

  const [page, setPage] = useState('dashboard');

  if (location.pathname.startsWith('/responder')) {
    return <Colaborador />;
  }

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  const pages = {
    dashboard: <Dashboard setPage={setPage} />,
    empresas: <Empresas />,
    questionarios: <Questionarios />,
    resultados: <Resultados />,
    plano: <Plano />
  };

  return (
    <div className="app">
      <Sidebar
        page={page}
        setPage={setPage}
        logout={() => {
          localStorage.clear();
          setUser(null);
        }}
      />

      {pages[page]}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);