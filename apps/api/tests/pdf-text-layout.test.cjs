const {test}=require('node:test'),assert=require('node:assert/strict');
const {pdfTextLayout,pdfWordGaps}=require('../dist/modules/assistant/pdf-text-layout');
test('PDF extraction keeps geometric word gaps without splitting adjacent letters or Chinese glyphs',()=>{
 const item=(str,x,y=100,width=20)=>({str,transform:[10,0,0,10,x,y],width,height:10});
 assert.equal(pdfTextLayout([item('CollabSpace',10,100,50),item('Word',63),item('baseline',87)]),'CollabSpace Word baseline');
 assert.equal(pdfTextLayout([item('Hel',0),item('lo',20)]),'Hello');
 assert.equal(pdfTextLayout([item('中',0,100,10),item('文',10,100,10),item('Next line',0,80)]),'中文\nNext line');
 assert.equal(pdfTextLayout([{str:''},item('Keep ',0),item('spaces',25)]),'Keep spaces');
});
test('Office PDF kerning separates words but preserves ordinary letter spacing',()=>{
 const glyph=unicode=>({unicode});
 const run=[glyph('Hello'),-10,glyph('World'),-250,glyph('again')];
 assert.equal(pdfWordGaps([run]).get('HelloWorldagain'),'HelloWorld again');
 assert.equal(pdfWordGaps([[glyph('A'),-250,glyph('B'),-250,glyph('C')]]).size,0);
 const paragraph=[...Array.from('Original').map(glyph),-220,...Array.from('paragraph').map(glyph),-220,...Array.from('remains').map(glyph)];
 assert.equal(pdfWordGaps([paragraph]).get('Originalparagraphremains'),'Original paragraph remains');
});
