# OrbisV 8.0 — Laboratórios de Matemática

**Visualize · Explore · Descubra**  
**Matemática em qualquer dimensão.**

Plataforma estática de apoio ao professor e prática do aluno. Organização por conteúdo, com livre acesso aos laboratórios e ao Caderno. Sem seleção de níveis ou aulas teóricas incorporadas.

## Abrir o programa

Extraia o ZIP inteiro e abra `index.html`. Preserve a estrutura das pastas. Os módulos e o motor simbólico estão no pacote; os cálculos não dependem de serviços externos.

Para instalar como aplicativo web e preparar o cache offline, sirva a pasta por HTTPS ou localhost. Com Python instalado:

```bash
python -m http.server 8000
```

Acesse `http://localhost:8000`. A primeira carga completa prepara o cache offline. A abertura direta por arquivo local também foi verificada no Chromium; a persistência nessa modalidade depende das políticas do navegador.

## Conteúdos implementados

| Área | Ferramentas específicas | Editores gráficos | Total |
|---|---:|---:|---:|
| Fundamentos da Matemática | 21 | 2 | 23 |
| Geometria Analítica | 10 | 2 | 12 |
| Álgebra Vetorial | 9 | 2 | 11 |
| Cálculo I | 13 | 2 | 15 |
| Cálculo II | 28 | 4 | 32 |
| **Total** | **81** | **12** | **93** |

O arquivo `COBERTURA.md` contém a matriz completa, os limites de implementação e sugestões de extensão. O escopo é o percurso definido para o OrbisV, dos fundamentos ao Cálculo II. Não representa toda a matemática nem um solucionador universal. Várias variáveis aparecem em um grupo próprio, permitindo ao professor adequar o uso à sua ementa.

## Utilizar os laboratórios específicos

1. Escolha a área e localize a ferramenta pelo grupo ou pela busca.
2. Edite os dados e clique em **Calcular e visualizar**. **Restaurar exemplo** repõe os valores iniciais.
3. Para treino, marque **Treinar antes de ver os resultados**. Após calcular, escolha uma grandeza numérica, digite sua resposta e confira. A tolerância é `10⁻⁴ × max(1, |resultado|)`. Resultados exclusivamente textuais ou simbólicos permitem registrar uma hipótese e comparar após a revelação.
4. Use **Registrar no Caderno** para guardar entradas, resultados, método e observações. Acrescente seus cálculos e comentários à anotação.
5. Exporte o resultado em JSON, tabelas ou amostras em CSV e visualizações em SVG, quando disponíveis.

Nas expressões, use `pi`, `sqrt(x)`, `sin(x)` ou `sen(x)`, `ln(x)` e `log(x)` na base 10. São aceitas vírgulas decimais. Separe componentes, listas e colunas por ponto e vírgula. Separe linhas de matrizes por Enter. Ângulos são em radianos, exceto campos que indiquem graus.

As entradas são independentes por laboratório. Alterar um dado invalida a saída anterior. Os cálculos rodam em um Web Worker local, com cancelamento e limite de 12 segundos. Um cálculo que não termina apresenta mensagem para reduzir o problema; não bloqueia a navegação.

## Laboratório gráfico livre

Os sete modos originais permanecem disponíveis nas 12 práticas gráficas: Função, Paramétrica, Vetor, Geometria, Discos/Anéis, Curva 3D e Reta 3D. Mantêm objetos editáveis, teclado matemático, zoom, câmera orbital, inspeção, cores, visibilidade, histórico, desfazer/refazer, modelos e exportação.

Cada prática gráfica conserva sua própria cena, rascunhos e visualização. No editor, argumentos de operações de cálculo são separados por **ponto e vírgula**: `diff(x^3-3x;x)` e `integral(t^2;t;0;x)`. Essas operações do editor são numéricas. Os laboratórios específicos de derivação e primitivas usam o motor simbólico.

## Caderno e compatibilidade

O Caderno guarda até 200 anotações, com 120.000 caracteres por texto. Importa arquivos de até 16 MB e acrescenta registros, sem sobrescrever anotações diferentes. Registros idênticos são ignorados. Arquivos inválidos são rejeitados antes da importação.

Há dois tipos de registro: cenas gráficas e experimentos calculados. Reabrir uma cena restaura objetos e visualização; reabrir um experimento preenche suas entradas para novo cálculo. Resultados já registrados permanecem na anotação e não mudam quando a ferramenta é recalculada.

O formato antigo de cenas e Cadernos da versão 7 permanece aceito. Experimentos específicos novos devem ser reabertos na versão 8. Exporte Caderno e projetos para transferir dados entre instalações, pastas ou dispositivos. Não há sincronização em nuvem. Se o armazenamento local atingir a cota do navegador, a interface informa a falha e permite exportar.

## Natureza dos resultados

- Frações e contagens combinatórias usam inteiros `BigInt` onde indicado.
- Manipulações simbólicas usam Nerdamer 1.1.13, incluído com sua licença MIT. Identidades preservam as restrições do domínio original; uma expressão simplificada não redefine o domínio.
- Demais medidas e avaliações usam precisão dupla, com arredondamento de apresentação. Valores exportados preservam a precisão calculada.
- Gráficos, busca de raízes, limites gerais, extremos e análises por caminhos são explorações numéricas. Ausência de um ponto amostrado não comprova inexistência.
- Séries e integrais impróprias têm classificação analítica apenas nas famílias explicitamente indicadas. Tabelas finitas não demonstram convergência geral.
- Erros locais de quadratura e diferenças entre métodos não são limites rigorosos de erro global. Singularidades, oscilações rápidas e sistemas mal condicionados exigem análise específica.
- O aplicativo não gera demonstrações formais, não decide todas as hipóteses de teoremas e não substitui a avaliação do professor.

## Estrutura técnica

| Componente | Responsabilidade |
|---|---|
| `js/catalog.js` e `js/labs/extend-catalog.js` | Catálogo, grupos, rotas e práticas |
| `js/labs/kernel.js` | Validação de expressões, operações numéricas e interface simbólica |
| `js/labs/fundamentals.js`, `geometry.js`, `vectors.js` | Módulos de fundamentos, geometria e álgebra vetorial |
| `js/labs/calculus1.js`, `calculus2.js`, `multivariable.js` | Módulos de cálculo |
| `js/labs/workbench.js` | Formulários, treino, gráficos, exportação e registros |
| `js/labs/worker-source.js` | Pacote autônomo do Worker; permite operar sem importações de rede |
| `js/platform.js` | Navegação, Caderno e isolamento de sessões gráficas |
| `js/mathEngine.js`, `graphObjects.js`, `graphEngine.js`, `ui.js` | Editor gráfico original e seu parser |
| `css/workbench.css` | Interface das ferramentas específicas |
| `sw.js` | Cache offline versionado |

As entradas matemáticas são validadas por AST e convertidas para o motor simbólico. O aplicativo não executa texto do usuário como JavaScript. O fornecedor simbólico é mantido separado em `js/vendor/`.

Ao editar módulos, recompile o Worker com:

```bash
python scripts/build-worker.py
```

Não é necessário executar esse comando para usar o ZIP entregue. Ao distribuir outra versão, atualize o identificador dos scripts e o cache do service worker conjuntamente.

## Verificação reproduzível

```bash
node tests/mathematics.cjs
```

O teste acima não instala dependências: carrega os arquivos do próprio pacote. Foram aprovados 144 casos, incluindo todos os exemplos iniciais, identidades, valores de referência e entradas inválidas.

Para repetir a verificação de interface, instale as dependências de desenvolvimento, instale o Chromium do Playwright e execute:

```bash
npm install
npx playwright install chromium
npm run test:browser
```

Um Chromium já instalado pode ser indicado pela variável `ORBISV_CHROMIUM`. Os 99 testes de interface foram aprovados no Chromium 153 em desktop e viewport móvel. Os relatórios estão em `tests/`. Emulação móvel não equivale a teste em aparelhos físicos; outros motores de navegador não foram certificados nesta entrega.
