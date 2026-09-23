(function(g){'use strict';
const descriptions={fundamentos:'Números, lógica, álgebra, funções, geometria elementar, trigonometria e dados.',geometria:'Coordenadas, retas, cônicas, planos e superfícies no espaço.','algebra-vetorial':'Vetores, matrizes, sistemas, bases, ortogonalidade e transformações.','calculo-1':'Limites, derivadas, aplicações, aproximações e fundamentos da integração.','calculo-2':'Técnicas de integração, aplicações, equações diferenciais, séries e várias variáveis.'};
const areas=g.OrbisCatalog.areas.map(a=>{const extra=g.LabKit.modules.filter(m=>m.areaId===a.id);return {...a,description:descriptions[a.id],topics:[...new Set(extra.map(m=>m.group))],labs:[...extra,...a.labs.map(l=>({...l,group:'Laboratório gráfico livre',kind:'scene'}))]};});
const labs=Object.fromEntries(areas.flatMap(a=>a.labs.map(l=>[l.id,{...l,areaTitle:a.title,areaShort:a.short,areaId:a.id}])));
g.OrbisCatalog=Object.freeze({areas,labs});
})(window);
