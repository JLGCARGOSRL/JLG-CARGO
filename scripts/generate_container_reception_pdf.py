from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image, KeepTogether

ROOT = Path(__file__).resolve().parents[1]
OUT_PUBLIC = ROOT / "public/forms/formulario-recepcion-contenedor-jlg.pdf"
OUT_COPY = ROOT / "output/pdf/formulario-recepcion-contenedor-jlg.pdf"
LOGO = ROOT / "public/jlg-cargo-logo.jpg"
NAVY = colors.HexColor("#0f172a")
BLUE = colors.HexColor("#1d4ed8")
LIGHT = colors.HexColor("#f1f5f9")
MID = colors.HexColor("#cbd5e1")

for target in (OUT_PUBLIC, OUT_COPY):
    target.parent.mkdir(parents=True, exist_ok=True)

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="Small", parent=styles["Normal"], fontName="Helvetica", fontSize=6.7, leading=8.2, textColor=NAVY))
styles.add(ParagraphStyle(name="Label", parent=styles["Small"], fontName="Helvetica-Bold", fontSize=6.4, leading=7.5, textColor=colors.HexColor("#475569")))
styles.add(ParagraphStyle(name="Section", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=9, leading=11, textColor=colors.white))
styles.add(ParagraphStyle(name="TitleJLG", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=16, leading=18, textColor=NAVY))

def line_field(label, height=8*mm):
    return Table([[Paragraph(label.upper(), styles["Label"])], [""]], colWidths=[None], rowHeights=[4*mm, height-4*mm], style=TableStyle([
        ("BOX",(0,0),(-1,-1),0.55,MID),("LINEBELOW",(0,0),(-1,0),0.35,MID),("LEFTPADDING",(0,0),(-1,-1),2.5*mm),("RIGHTPADDING",(0,0),(-1,-1),2.5*mm),("TOPPADDING",(0,0),(-1,-1),1.2*mm),("BOTTOMPADDING",(0,0),(-1,-1),1*mm)
    ]))

def section(title, fields, widths, height=8*mm):
    cells=[line_field(f,height) for f in fields]
    header=Table([[Paragraph(title.upper(),styles["Section"])]],colWidths=[sum(widths)],rowHeights=[7*mm],style=TableStyle([("BACKGROUND",(0,0),(-1,-1),NAVY),("LEFTPADDING",(0,0),(-1,-1),3*mm),("VALIGN",(0,0),(-1,-1),"MIDDLE")]))
    body=Table([cells],colWidths=widths,style=TableStyle([("VALIGN",(0,0),(-1,-1),"TOP"),("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),1.5*mm)]))
    return KeepTogether([header,Spacer(1,1.5*mm),body,Spacer(1,3*mm)])

def checkbox_row(labels):
    return Table([[f"[ ] {x}" for x in labels]],colWidths=[(190*mm)/len(labels)]*len(labels),style=TableStyle([("FONTNAME",(0,0),(-1,-1),"Helvetica"),("FONTSIZE",(0,0),(-1,-1),7),("BOX",(0,0),(-1,-1),0.5,MID),("INNERGRID",(0,0),(-1,-1),0.35,MID),("BACKGROUND",(0,0),(-1,-1),LIGHT),("LEFTPADDING",(0,0),(-1,-1),2.5*mm),("TOPPADDING",(0,0),(-1,-1),2.2*mm),("BOTTOMPADDING",(0,0),(-1,-1),2.2*mm)]))

def header(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(NAVY); canvas.setLineWidth(1); canvas.line(13*mm,13*mm,203*mm,13*mm)
    canvas.setFont("Helvetica",6.5); canvas.setFillColor(colors.HexColor("#64748b"))
    canvas.drawString(13*mm,8.5*mm,"ALMACEN JLG CARGO · AUTOPISTA DUARTE KM 17 1/2 · RNC 131784925")
    canvas.drawRightString(203*mm,8.5*mm,f"Página {doc.page}")
    canvas.restoreState()

def build(target):
    doc=SimpleDocTemplate(str(target),pagesize=letter,rightMargin=13*mm,leftMargin=13*mm,topMargin=11*mm,bottomMargin=17*mm)
    story=[]
    logo=Image(str(LOGO),width=38*mm,height=19*mm)
    title=Table([[Paragraph("FORMULARIO DE RECEPCIÓN<br/>DE CONTENEDOR",styles["TitleJLG"]),Paragraph("DOCUMENTO DE CAMPO<br/><font size='7' color='#64748b'>Completar en letra legible</font>",styles["Small"])]],colWidths=[92*mm,55*mm],style=TableStyle([("VALIGN",(0,0),(-1,-1),"MIDDLE"),("ALIGN",(1,0),(1,0),"RIGHT")]))
    story.append(Table([[logo,title]],colWidths=[42*mm,148*mm],style=TableStyle([("VALIGN",(0,0),(-1,-1),"MIDDLE"),("BOTTOMPADDING",(0,0),(-1,-1),3*mm)])))
    story.append(section("Control del documento",["Número de recepción","Fecha","Hora llegada","Puerta / muelle"],[55*mm,45*mm,38*mm,47.5*mm]))
    story.append(section("Manifiesto y equipo",["Manifiesto de aduanas","Número de contenedor","Tipo / tamaño","Naviera o propietario"],[55*mm,50*mm,35*mm,45.5*mm]))
    story.append(section("Traslado aduanal",["Administración aduanera","Tipo de traslado","Sello declarado","Sello encontrado"],[55*mm,45*mm,42*mm,43.5*mm]))
    story.append(checkbox_row(["Sello correcto","Sello diferente","Sello roto","Sello ausente"]))
    story.append(Spacer(1,3*mm))
    story.append(section("Transporte",["Empresa transportista","Nombre del conductor","Cédula","Teléfono"],[50*mm,55*mm,40*mm,40.5*mm]))
    story.append(section("Vehículo",["Placa cabezote","Placa chasis","Hora entrada","Hora salida"],[48*mm,48*mm,44*mm,45.5*mm]))
    story.append(Table([[Paragraph("INSPECCIÓN EXTERIOR DEL CONTENEDOR",styles["Section"])]],colWidths=[185.5*mm],rowHeights=[7*mm],style=TableStyle([("BACKGROUND",(0,0),(-1,-1),NAVY),("LEFTPADDING",(0,0),(-1,-1),3*mm),("VALIGN",(0,0),(-1,-1),"MIDDLE")])))
    story.append(Spacer(1,1.5*mm)); story.append(checkbox_row(["Buen estado","Golpes","Perforaciones","Óxido","Humedad / agua","Puertas dañadas"])); story.append(Spacer(1,2*mm))
    story.append(section("Detalles de inspección",["Temperatura °C (refrigerado)","Observaciones del sello y condición exterior"],[55*mm,130.5*mm],12*mm))
    story.append(PageBreak())
    story.append(Paragraph("RECEPCIÓN DE CONTENEDOR - CONCILIACIÓN Y CIERRE",styles["TitleJLG"])); story.append(Spacer(1,4*mm))
    headers=["Línea / BL","Cliente","Descripción","Esperado","Recibido","Dañado","Peso KG","Condición"]
    widths=[24*mm,30*mm,46*mm,16*mm,16*mm,15*mm,18*mm,20.5*mm]
    data=[[Paragraph(h,styles["Label"]) for h in headers]]+[["" for _ in headers] for _ in range(8)]
    story.append(Table([[Paragraph("CONCILIACIÓN DE CLIENTES Y BL",styles["Section"])]],colWidths=[sum(widths)],rowHeights=[7*mm],style=TableStyle([("BACKGROUND",(0,0),(-1,-1),NAVY),("LEFTPADDING",(0,0),(-1,-1),3*mm),("VALIGN",(0,0),(-1,-1),"MIDDLE")])))
    story.append(Spacer(1,1.5*mm)); story.append(Table(data,colWidths=widths,rowHeights=[6*mm]+[8.5*mm]*8,repeatRows=1,style=TableStyle([("BACKGROUND",(0,0),(-1,0),LIGHT),("GRID",(0,0),(-1,-1),0.4,MID),("VALIGN",(0,0),(-1,-1),"MIDDLE"),("LEFTPADDING",(0,0),(-1,-1),1.5*mm),("RIGHTPADDING",(0,0),(-1,-1),1.5*mm)])))
    story.append(Spacer(1,4*mm))
    story.append(section("Control de descarga",["Inicio de descarga","Fin de descarga","Supervisor","Cantidad de pallets"],[45*mm,45*mm,55*mm,40.5*mm]))
    story.append(checkbox_row(["Montacargas","Pallet jack","Grúa","Mano de obra","Otro: __________________"]))
    story.append(Spacer(1,3*mm))
    story.append(section("Resultado de conciliación",["Bultos esperados","Bultos recibidos","Faltantes","Sobrantes","Dañados"],[38*mm,38*mm,35*mm,35*mm,39.5*mm],10*mm))
    story.append(checkbox_row(["Cuadre correcto","Con diferencias","En cuarentena","Pendiente documentos","Cerrado"]))
    story.append(Spacer(1,3*mm))
    story.append(line_field("Incidentes, daños y medidas tomadas",18*mm)); story.append(Spacer(1,2*mm))
    story.append(line_field("Observaciones generales",14*mm)); story.append(Spacer(1,3*mm))
    photo_cells=[]
    for label in ["FOTO CONTENEDOR","FOTO SELLO","FOTO PLACAS","FOTO DAÑOS / CARGA"]:
        photo_cells.append(Table([[Paragraph(label,styles["Label"])],[Paragraph("Adjuntar evidencia digital",styles["Small"])]],rowHeights=[6*mm,14*mm],style=TableStyle([("BOX",(0,0),(-1,-1),0.5,MID),("LINEBELOW",(0,0),(-1,0),0.35,MID),("ALIGN",(0,0),(-1,-1),"CENTER"),("VALIGN",(0,1),(-1,1),"MIDDLE"),("BACKGROUND",(0,0),(-1,0),LIGHT)])))
    story.append(Table([photo_cells],colWidths=[45.2*mm]*4,style=TableStyle([("VALIGN",(0,0),(-1,-1),"TOP"),("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),1.5*mm)]))); story.append(Spacer(1,1*mm))
    signatures=[]
    for title_text in ["CONDUCTOR / TRANSPORTISTA","SEGURIDAD JLG","OPERADOR DE RECEPCIÓN","SUPERVISOR DE DESCARGA"]:
        signatures.append(Table([[""],[Paragraph(title_text,styles["Label"])],[Paragraph("Firma, nombre y fecha",styles["Small"])]],rowHeights=[9*mm,5*mm,4*mm],style=TableStyle([("LINEBELOW",(0,0),(-1,0),0.6,NAVY),("ALIGN",(0,1),(-1,-1),"CENTER")])))
    story.append(Table([signatures],colWidths=[45.2*mm]*4,style=TableStyle([("VALIGN",(0,0),(-1,-1),"TOP"),("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),2*mm)])))
    doc.build(story,onFirstPage=header,onLaterPages=header)

build(OUT_PUBLIC)
OUT_COPY.write_bytes(OUT_PUBLIC.read_bytes())
print(OUT_PUBLIC)
