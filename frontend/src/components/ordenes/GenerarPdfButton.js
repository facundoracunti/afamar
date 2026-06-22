import React, { useEffect, useState } from 'react';
import { FileDown, Eye, Send } from 'lucide-react';
import { buildDocDefinition } from './pdfClienteTemplate';
import { buildPdfData } from './pdfDataMapper';

export default function GenerarPdfButton({ form, materialesCatalogo, logoUrl, portadaUrl, presupuestoNumero, orientacion = 'horizontal', labelDescargar = 'Descargar PDF', labelVistaPrevia = 'Vista previa', labelWhatsApp = 'Enviar WhatsApp', showVistaPrevia = true, showWhatsApp = true }) {
  const [pdfmake, setPdfmake] = useState(null);

  useEffect(() => {
    Promise.all([
      import('pdfmake/build/pdfmake'),
      import('pdfmake/build/vfs_fonts'),
      import('pdfmake/build/standard-fonts/Helvetica'),
      import('pdfmake/build/standard-fonts/Times'),
    ]).then(([pdfmakeModule, vfsMod, helveticaMod, timesMod]) => {
      const instance = pdfmakeModule.default || pdfmakeModule;
      const vfs = vfsMod.default || vfsMod;
      const helvetica = helveticaMod.default || helveticaMod;
      const times = timesMod.default || timesMod;
      instance.addVirtualFileSystem(vfs);
      if (typeof instance.addFontContainer === 'function') {
        instance.addFontContainer(helvetica);
        instance.addFontContainer(times);
      }
      setPdfmake(() => instance);
    }).catch((err) => {
      console.warn('pdfmake not available:', err.message);
    });
  }, []);

  const pdfData = buildPdfData(form, { materialesCatalogo, logoUrl, portadaUrl });
  pdfData.presupuestoNumero = presupuestoNumero || form.numero || 'P-_____';

  const handleVistaPrevia = () => {
    if (!pdfmake) return;
    const def = buildDocDefinition(pdfData);
    pdfmake.createPdf(def).open();
  };

  const handleDescargar = () => {
    if (!pdfmake) return;
    const def = buildDocDefinition(pdfData);
    const fn = `${presupuestoNumero || form.numero || 'presupuesto'}.pdf`;
    pdfmake.createPdf(def).download(fn);
  };

  const handleWhatsApp = () => {
    const tel = form.cliente_telefono_orden || '';
    const nom = form.cliente_nombre || 'Cliente';
    const num = form.numero || presupuestoNumero || '';
    const total = `$ ${Number(form.total || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
    const msg = encodeURIComponent(`Hola ${nom}, te enviamos tu presupuesto AFAMAR N° ${num} por un total de ${total}. Podés descargarlo en: [link pendiente]`);
    const url = tel ? `https://wa.me/${tel.replace(/[^0-9]/g, '')}?text=${msg}` : '#';
    window.open(url, '_blank');
  };

  const btnStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 16px',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    transition: '0.2s',
    textDecoration: 'none',
  };

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {showVistaPrevia && (
        <button onClick={handleVistaPrevia} disabled={!pdfmake} style={{ ...btnStyle, background: '#f3f4f6', color: '#1e293b' }}>
          <Eye size={16} /> {labelVistaPrevia}
        </button>
      )}
      <button onClick={handleDescargar} disabled={!pdfmake} style={{ ...btnStyle, background: '#b91c1c', color: '#fff' }}>
        <FileDown size={16} /> {labelDescargar}
      </button>
      {showWhatsApp && (
        <button onClick={handleWhatsApp} disabled={!pdfmake} style={{ ...btnStyle, background: '#059669', color: '#fff' }}>
          <Send size={16} /> {labelWhatsApp}
        </button>
      )}
    </div>
  );
}
