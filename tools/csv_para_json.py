"""
Converte o CSV exportado do Google Forms em data/pesquisa.json (lido pelo dashboard).

Uso:
    python tools/csv_para_json.py respostas.csv

No Google Forms: aba Respostas > ícone do Planilhas > Arquivo > Fazer download > CSV.
O script identifica as colunas pelo texto da pergunta, então a ordem não importa,
mas as perguntas devem ter o texto usado no questionário do projeto.
Respostas sem consentimento ("Não") são descartadas. Nenhum dado pessoal é gravado.
"""
import csv
import json
import sys
import unicodedata
from datetime import datetime
from pathlib import Path


def norm(s):
    return unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()


# palavra-chave no cabeçalho -> (campo no JSON, tipo)
MAPA = [
    ("aceito", "consentimento", "texto"),
    ("faixa etaria", "faixaEtaria", "texto"),
    ("tipo de deficiencia", "deficiencia", "texto"),
    ("dispositivo", "dispositivo", "texto"),
    ("tecnologia assistiva", "tecnologiaAssistiva", "lista"),
    ("frequencia", "frequenciaBarreiras", "numero"),
    ("quais barreiras", "barreiras", "lista"),
    ("tipo de servico", "servicosDificeis", "lista"),
    ("quais recursos", "recursosDesejados", "lista"),
    ("satisfacao", "satisfacao", "numero"),
    ("conte uma situacao", "relato", "texto"),
]

# Opções que contêm vírgula no texto: protegidas antes de dividir a lista
COM_VIRGULA = ["Governo (gov.br, INSS)"]


def dividir(valor):
    for i, op in enumerate(COM_VIRGULA):
        valor = valor.replace(op, f"__OP{i}__")
    itens = [v.strip() for v in valor.split(",") if v.strip()]
    for i, op in enumerate(COM_VIRGULA):
        itens = [x.replace(f"__OP{i}__", op) for x in itens]
    return itens


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    origem = Path(sys.argv[1])
    with origem.open(encoding="utf-8-sig") as f:
        linhas = list(csv.reader(f))
    cab, dados = linhas[0], linhas[1:]

    colunas = {}
    for idx, titulo in enumerate(cab):
        t = norm(titulo)
        for chave, campo, tipo in MAPA:
            if chave in t and campo not in colunas:
                colunas[campo] = (idx, tipo)
                break
    faltando = [c for _, c, _ in MAPA if c not in colunas and c != "consentimento"]
    if faltando:
        print("Atenção: colunas não encontradas:", faltando)

    respostas, descartadas = [], 0
    for linha in dados:
        r = {}
        for campo, (idx, tipo) in colunas.items():
            v = linha[idx].strip() if idx < len(linha) else ""
            if tipo == "lista":
                r[campo] = dividir(v)
            elif tipo == "numero":
                r[campo] = int(v) if v.isdigit() else None
            else:
                r[campo] = v
        if "nao" in norm(r.pop("consentimento", "sim")):
            descartadas += 1
            continue
        r = {"id": len(respostas) + 1, **r}
        respostas.append(r)

    saida = Path(__file__).resolve().parent.parent / "data" / "pesquisa.json"
    json.dump(
        {
            "meta": {
                "titulo": "Pesquisa de campo – Barreiras de Acessibilidade em Interfaces Digitais",
                "periodo": f"Coleta até {datetime.now():%d/%m/%Y}",
                "fonte": "Google Forms (respostas reais, anonimizadas)",
                "exemplo": False,
            },
            "respostas": respostas,
        },
        saida.open("w", encoding="utf-8"),
        ensure_ascii=False,
        indent=2,
    )
    print(f"{len(respostas)} respostas gravadas em {saida} ({descartadas} sem consentimento descartadas)")


if __name__ == "__main__":
    main()
