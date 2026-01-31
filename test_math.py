import latex2mathml.converter
from lxml import etree
import os

latex = "x^2 + y_1 = z"
print(f"LaTeX: {latex}")

try:
    mathml = latex2mathml.converter.convert(latex)
    print("--- MathML (Partial) ---")
    print(mathml[:100])
    
    xslt_path = "MML2OMML.xsl"
    if not os.path.exists(xslt_path):
        print("MML2OMML.xsl NOT FOUND!")
        exit(1)
        
    xslt_tree = etree.parse(xslt_path)
    transform = etree.XSLT(xslt_tree)
    
    mathml_tree = etree.fromstring(mathml)
    omml_tree = transform(mathml_tree)
    
    print("--- OMML Conversion Success ---")
    print(etree.tostring(omml_tree, encoding='unicode')[:200])
    
except Exception as e:
    print(f"Error: {e}")
