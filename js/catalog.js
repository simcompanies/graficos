(function (global) {
  'use strict';

  // Pedagogical organization is independent of the renderer and its objects.
  const areas = [
    { id:'fundamentos', title:'Fundamentos da Matemática', short:'Fundamentos', symbol:'f(x)',
      description:'Expressões, funções elementares e leitura de gráficos.',
      topics:['Expressões numéricas e algébricas','Funções elementares','Domínios e gráficos'],
      labs:[
        {id:'fund-funcoes',mode:'function',icon:'f',title:'Funções e gráficos',summary:'Edite expressões e compare seus gráficos no plano cartesiano.',focus:'Expressões e domínios',draft:{expression:'x^2',xMin:'',xMax:''}},
        {id:'fund-modelos',mode:'function',icon:'x²',title:'Modelos de variação',summary:'Trabalhe com funções lineares, quadráticas, exponenciais e trigonométricas.',focus:'Comparação de funções',draft:{expression:'2x+1',xMin:'',xMax:''}}
      ]},
    { id:'geometria',title:'Geometria Analítica',short:'Geometria analítica',symbol:'(x, y)',
      description:'Coordenadas e construções no plano e no espaço.',
      topics:['Pontos e retas','Círculos e elipses','Polígonos','Retas no espaço'],
      labs:[
        {id:'geo-plano',mode:'geometry',icon:'△',title:'Construções no plano',summary:'Crie pontos, retas, círculos, elipses e polígonos editáveis.',focus:'Coordenadas e construções'},
        {id:'geo-espaco',mode:'line3d',icon:'r',title:'Retas no espaço',summary:'Defina uma reta por dois pontos ou por um ponto e um vetor diretor.',focus:'Visualização em 3D'}
      ]},
    { id:'algebra-vetorial',title:'Álgebra Vetorial',short:'Álgebra vetorial',symbol:'u → v',
      description:'Vetores, componentes e representações paramétricas.',
      topics:['Vetores no plano','Módulo e direção','Trajetórias paramétricas'],
      labs:[
        {id:'alg-vetores',mode:'vector',icon:'→',title:'Vetores no plano',summary:'Defina a origem e a extremidade e compare módulo e direção.',focus:'Coordenadas e medidas'},
        {id:'alg-parametric',mode:'parametric',icon:'t',title:'Trajetórias paramétricas',summary:'Edite x(t), y(t) e o intervalo do parâmetro.',focus:'Curvas no plano'}
      ]},
    { id:'calculo-1',title:'Cálculo I',short:'Cálculo I',symbol:'d/dx',
      description:'Exploração de limites, continuidade, derivadas e variação.',
      topics:['Limites numéricos','Continuidade visual','Derivadas numéricas','Raízes e extremos'],
      labs:[
        {id:'calc1-limites',mode:'function',icon:'lim',title:'Limites e continuidade',summary:'Examine aproximações, descontinuidades e assíntotas no gráfico.',focus:'Comportamento das funções',draft:{expression:'(x^2-1)/(x-1)',xMin:'',xMax:''}},
        {id:'calc1-derivadas',mode:'function',icon:'d',title:'Derivadas e variação',summary:'Represente derivadas numéricas e compare crescimento e extremos.',focus:'Função e derivada',draft:{expression:'diff(x^3-3x;x)',xMin:'',xMax:''}}
      ]},
    { id:'calculo-2',title:'Cálculo II',short:'Cálculo II',symbol:'∫',
      description:'Integração numérica, sólidos de revolução e curvas paramétricas.',
      topics:['Integrais definidas numéricas','Volumes por discos e anéis','Curvas paramétricas 2D e 3D'],
      labs:[
        {id:'calc2-integracao',mode:'washers',icon:'∫',title:'Discos e anéis',summary:'Edite os raios, o eixo e o intervalo e visualize o sólido de revolução.',focus:'Seções e volume'},
        {id:'calc2-integrais',mode:'function',icon:'∫',title:'Integrais definidas',summary:'Teste expressões de integração numérica no editor matemático.',focus:'Integral e acumulação',draft:{expression:'integral(t^2;t;0;x)',xMin:'-3',xMax:'3'}},
        {id:'calc2-parametric',mode:'parametric',icon:'t',title:'Curvas paramétricas',summary:'Explore formas, laços e intervalos em curvas do plano.',focus:'Representação paramétrica',draft:{xExpr:'cos(3t)',yExpr:'sin(2t)',tMin:'0',tMax:'2pi'}},
        {id:'calc2-curvas3d',mode:'curve3d',icon:'∿',title:'Curvas no espaço',summary:'Edite x(t), y(t), z(t) e observe a curva com a câmera orbital.',focus:'Vetores posição em 3D'}
      ]}
  ];
  const labs = Object.fromEntries(areas.flatMap(area => area.labs.map(lab => [lab.id, {...lab,areaId:area.id,areaTitle:area.title,areaShort:area.short}])));
  global.OrbisCatalog = Object.freeze({areas, labs});
})(window);
